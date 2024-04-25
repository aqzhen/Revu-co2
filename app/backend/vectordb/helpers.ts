import fs from "fs";
import mysql, { RowDataPacket } from "mysql2/promise";
import OpenAI from "openai";
import { Query, Review, User } from "../../globals";
import { getCustomerProductPurchases } from "../api_calls";
import { Chunk, chunk_string } from "../langchain/chunking";

let singleStoreConnection: mysql.Connection;
export async function connectToSingleStore() {
  try {
    singleStoreConnection = await mysql.createConnection({
      host: process.env.SINGLESTORE_HOST,
      user: process.env.SINGLESTORE_USER,
      port: 3333,
      password: process.env.SINGLESTORE_PASSWORD,
      database: process.env.SINGLESTORE_DATABASE,
      ssl: {
        ca: fs.readFileSync("./singlestore_bundle.pem"),
      },
    });
    console.log("You have successfully connected to SingleStore.");
    return singleStoreConnection;
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

process.on("exit", async () => {
  await disconnectFromSingleStore();
});

export async function disconnectFromSingleStore() {
  try {
    await singleStoreConnection.end();
    console.log("Disconnected from SingleStore.");
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

// Create Tables
export async function createReviewTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      await singleStoreConnection.execute("DROP TABLE IF EXISTS Review");
    }
    await singleStoreConnection.execute(`
            CREATE TABLE Review (
                reviewId BIGINT PRIMARY KEY,
                productId BIGINT,
                reviewerName VARCHAR(255),
                reviewerExternalId BIGINT,
                createdAt TIMESTAMP,
                updatedAt TIMESTAMP,
                verified VARCHAR(255),
                rating INT,
                title VARCHAR(255),
                body TEXT
            )
        `);
    console.log("Reviews table created successfully.");
  } catch (err) {
    console.log("Reviews table already exists");
  }
}

export async function createQueriesTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      await singleStoreConnection.execute("DROP TABLE IF EXISTS Queries");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Queries (
                    queryId BIGINT AUTO_INCREMENT PRIMARY KEY,
                    productId BIGINT,
                    userId BIGINT,
                    query TEXT,
                    queryEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, embedding for entire query
                    semanticEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, semantic embedding is embedding for relevant context of query
                    answer TEXT
                )
            `);
    console.log("Queries table created successfully.");
  } catch (err) {
    console.log("Queries table already exists");
  }
}

export async function createSellerQueriesTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      await singleStoreConnection.execute(
        "DROP TABLE IF EXISTS Seller_Queries",
      );
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Seller_Queries (
                  queryId BIGINT AUTO_INCREMENT PRIMARY KEY,
                  productId BIGINT,
                  userId BIGINT,
                  query TEXT,
                  queryEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, embedding for entire query
                  semanticEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, semantic embedding is embedding for relevant context of query
                  answer TEXT
              )
          `);
    console.log("Seller_Queries table created successfully.");
  } catch (err) {
    console.log("Seller_Queries table already exists");
  }
}

export async function createEmbeddingsTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      console.log("Dropping embedding table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Embeddings");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Embeddings (
                    reviewId BIGINT,
                    chunkNumber BIGINT,
                    body TEXT,
                    chunkEmbedding VECTOR(768),
                    startIndex BIGINT,
                    endIndex BIGINT,
                    PRIMARY KEY (reviewId, chunkNumber)
                )
            `);
    console.log("Embeddings table created successfully.");
  } catch (err) {
    console.log("Embeddings table already exists");
  }
}

export async function createPurchasesTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      console.log("Dropping purchases table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Purchases");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Purchases (
                    userId BIGINT,
                    productId BIGINT,
                    purchased BOOL,
                    quantity int,
                    PRIMARY KEY (userId, productId)
                )
            `);
    console.log("Purchases table created successfully.");
  } catch (err) {
    console.log("Purchases table already exists");
  }
}

// Adders
export async function addChunksToSingleStore(reviews: Review[]): Promise<void> {
  for (const review of reviews) {
    const chunks = await chunk_string(review.body, review.reviewId);
    let i = 1;
    for (const chunk of chunks) {
      try {
        const [results, buff] = await singleStoreConnection.execute(`
          INSERT IGNORE INTO Embeddings (
              reviewId,
              chunkNumber,
              body,
              startIndex,
              endIndex
          ) VALUES (
              ${review.reviewId},
              ${i},
              '${chunk.chunkBody.replace(/'/g, "\\'")}',
              ${chunk.startIndex},
              ${chunk.endIndex}
          )
      `);

        // only generate embedding if the review was added (new review)
        if ((results as any).affectedRows > 0) {
          const embedding = await generateEmbedding(chunk.chunkBody);
          // Do something with the embedding
          await singleStoreConnection.execute(
            `
            UPDATE Embeddings
            SET chunkEmbedding = ?
            WHERE reviewId = ? AND chunkNumber = ?
          `,
            [embedding, review.reviewId, i],
          );
          console.log("Chunk added successfully.");
        }
        i = i + 1;
      } catch (err) {
        console.log("Error adding chunks");
        console.log(err);
        process.exit(1);
      }
    }
  }
  console.log("Added chunks for all reviews");
}

// Add reviews to the SingleStore database, also index review bodies using OpenAI embeddings
export async function addReviewsToSingleStore(
  reviews: Review[],
): Promise<void> {
  for (const review of reviews) {
    try {
      const [results, buff] = await singleStoreConnection.execute(`
        INSERT IGNORE INTO Review (
            reviewId,
            productId,
            reviewerName,
            reviewerExternalId,
            createdAt,
            updatedAt,
            verified,
            rating,
            title,
            body
        ) VALUES (
            ${review.reviewId},
            ${review.productId},
            '${review.reviewerName.replace(/'/g, "\\'")}',
            ${review.reviewerExternalId},
            '${review.createdAt}',
            '${review.updatedAt}',
            '${review.verified}',
            ${review.rating},
            '${review.title.replace(/'/g, "\\'")}',
            '${review.body.replace(/'/g, "\\'")}'
        )
    `);
    } catch (err) {
      console.error("ERROR", err);
      process.exit(1);
    }
  }
}

export async function addQueryToSingleStore(
  productId: number,
  userId: number,
  answer: string,
  query: string,
): Promise<void> {
  try {
    await singleStoreConnection.execute(
      `
        INSERT IGNORE INTO Purchases (
            userId,
            productId,
            purchased,
            quantity
        ) VALUES (
            ${userId},
            ${productId},
            0,
            0
        )
        `,
    );
    const [results, buff] = await singleStoreConnection.execute(
      `
        INSERT INTO Queries (
            productId,
            userId,
            query,
            answer
        ) VALUES (
            ${productId},
            ${userId},
            '${query.replace(/'/g, "\\'")}',
            '${answer.replace(/'/g, "\\'")}'
        )
        `,
    );
    // only generate embedding if the query was added (this always happens for now, since queries aren't deduplicated)
    if ((results as any).affectedRows > 0) {
      const queryId = (results as any).insertId;

      // generate embedding and add to db
      const semanticEmbdding = await generateEmbedding(query);
      await singleStoreConnection.execute(
        `
          UPDATE Queries
          SET semanticEmbedding = ?
          WHERE queryId = ?
        `,
        [semanticEmbdding, queryId],
      );

      console.log("Query added successfully.");
      return queryId;
    }
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function addSellerQueryToSingleStore(
  productId: number,
  userId: number,
  answer: string,
  query: string,
): Promise<void> {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
        INSERT INTO Seller_Queries (
            productId,
            userId,
            query,
            answer
        ) VALUES (
            ${productId},
            ${userId},
            '${query.replace(/'/g, "\\'")}',
            '${answer.replace(/'/g, "\\'")}'
        )
        `,
    );

    // only generate embedding if the query was added (this always happens for now, since queries aren't deduplicated)
    if ((results as any).affectedRows > 0) {
      const queryId = (results as any).insertId;

      // generate embedding and add to db
      const semanticEmbdding = await generateEmbedding(query);
      await singleStoreConnection.execute(
        `
          UPDATE Seller_Queries
          SET semanticEmbedding = ?
          WHERE queryId = ?
        `,
        [semanticEmbdding, queryId],
      );

      console.log("Query added successfully.");
      return queryId;
    }
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function updatePurchasedStatus() {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
        SELECT userId, productId FROM Purchases WHERE purchased = 0
      `,
    );
    const rows = results as RowDataPacket[];
    const userIds: number[] = [];
    const productIds: number[] = [];
    rows.forEach((row) => {
      if (row.userId != 0) {
        userIds.push(row.userId);
      }
      productIds.push(row.productId);
    });

    console.log("User ID, productId", userIds[0], productIds[0]);

    // get the purchased products for each userId with call to shopify api
    for (let i = 0; i < userIds.length; i++) {
      let userId = userIds[i];
      let productId = productIds[i];
      let purchasedProducts = await (
        await getCustomerProductPurchases(userId)
      ).json();

      console.log(
        "Purchased products for user " + userId + " are: ",
        purchasedProducts,
      );

      // attempt to match purchased products of each user with productId in productIds array
      // if match, update purchased status to 1

      console.log(productId + "  " + purchasedProducts.productIds);
      if (purchasedProducts.productIds.includes(productId)) {
        console.log("Match found for user " + userId);
        const [results, buff] = await singleStoreConnection.execute(
          `
            UPDATE Purchases
            SET purchased = 1
            WHERE userId = ? AND productId = ?
          `,
          [userId, productId],
        );
      }
    }
    console.log("Updated purchased status successfully.");
    return null;
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

// Getters
export async function getReviewChunksInfo(
  reviewIDs: number[],
  chunkNumbers: number[],
): Promise<{ chunks: Chunk[] }> {
  try {
    console.log("Getting review chunks", reviewIDs, chunkNumbers);
    const chunks: Chunk[] = [];
    for (let i = 0; i < reviewIDs.length; i++) {
      const reviewID = reviewIDs[i];
      const chunkNumber = chunkNumbers[i];
      const [results, buff] = await singleStoreConnection.execute(
        `
          SELECT body, startIndex, endIndex FROM Embeddings WHERE reviewId = ? AND chunkNumber = ?
        `,
        [reviewID, chunkNumber],
      );
      const body = JSON.parse(JSON.stringify(results as RowDataPacket[]))[0]
        ?.body;
      const startIndex = JSON.parse(
        JSON.stringify(results as RowDataPacket[]),
      )[0]?.startIndex;
      const endIndex = JSON.parse(JSON.stringify(results as RowDataPacket[]))[0]
        ?.endIndex;
      let testChunk: Chunk = {
        chunkBody: body,
        startIndex: startIndex,
        endIndex: endIndex,
        reviewId: reviewID,
      };
      chunks.push(testChunk);
    }
    return { chunks };
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function getQueryInfo(
  queryIds: number[],
): Promise<{ userIds: number[]; queries: string[] }> {
  try {
    const userIds: number[] = [];
    const queries: string[] = [];
    for (let i = 0; i < queryIds.length; i++) {
      const queryId = queryIds[i];
      const [results, buff] = await singleStoreConnection.execute(
        `
        SELECT userId, query FROM Queries WHERE queryId = ?
      `,
        [queryId],
      );
      const userId = JSON.parse(JSON.stringify(results as RowDataPacket[]))[0]
        ?.userId;
      const query = JSON.parse(JSON.stringify(results as RowDataPacket[]))[0]
        ?.query;
      userIds.push(userId);
      queries.push(query);
    }
    return { userIds: userIds, queries: queries };
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function getProductQueries(
  productId: number,
): Promise<{ queries: Query[] }> {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
          SELECT queryId, query, userId FROM Queries WHERE productId = ?
        `,
      [productId],
    );
    const queries: Query[] = [];
    for (const row of results as RowDataPacket[]) {
      const query: Query = {
        queryId: row.queryId,
        query: row.query,
        userId: row.userId,
      };
      queries.push(query);
    }
    return { queries };
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function getAllUsers() {
  const [response, bufff] = await singleStoreConnection.execute(
    `
      SELECT userId
      FROM Queries
    `
  );
  const userIds = new Set<number>();
  for (const row of response as RowDataPacket[]) {
    userIds.add(row.userId);
  }
  
  const promises = [];
  // Iterate through the set using for...of loop
  for (const userId of userIds) {
    console.log("generating for user", userId);
    
    // Await getUser(userId) within the loop
    const response = await getUser(userId);
    
    // Push the resulting promise into the promises array
    promises.push(response.user);
  }

  const output = await Promise.all(promises);
  console.log(output[0])

  const tableDataMap: { [key: number]: any[][] } = {};
  const usersMap: { [key: number]: User } = {};
  for (const user of output) {
    const tableData = generateTableData(user);
    tableDataMap[user.userId] = tableData;
    usersMap[user.userId] = user;
  }
  
  return {allUsersData: output, tableDataMap: tableDataMap, usersMap: usersMap}
}

export async function getUser(
  userId: number
): Promise<{ user: User }> {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
        SELECT Q.queryId, Q.query, Q.userId, Q.productId
        FROM Queries Q
        WHERE Q.userId = ${userId}
      `
    );
    const queries: Query[] = [];
    for (const row of results as RowDataPacket[]) {
      const query: Query = {
        queryId: row.queryId,
        query: row.query,
        userId: row.userId,
        productId : row.productId
      };
      queries.push(query);
    }

    const [results2, buff2] = await singleStoreConnection.execute(
      `
        SELECT R.reviewerName, R.productId, R.reviewerExternalId, R.createdAt, R.updatedAt,
                R.verified, R.reviewId, R.rating, R.title, R.body
        FROM Review R
        WHERE R.reviewerExternalId = ${userId}
      `
    );
    const reviews: Review[] = [];
    let userName = ""
    for (const row of results2 as RowDataPacket[]) {
      userName = row.reviewerName;
      const review: Review = {
        reviewerName : row.reviewerName,
        productId : row.productId,
        reviewerExternalId : row.reviewerExternalId,
        createdAt : row.createdAt,
        updatedAt : row.updatedAt,
        verified : row.verified,
        reviewId : row.reviewId,
        rating : row.rating,
        title : row.title,
        body : row.body
      };
      reviews.push(review);
    }

    const user: User = {
      userId : userId,
      name : userName,
      queries : queries,
      reviews : reviews
    }
    // console.log(user)
    // return { queries };
    return { user: user }
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export function generateTableData(user: User): any[][] {
  const tableData: any[][] = [];

  const productIdSet = new Set<number>(); // Use a Set to keep track of unique productIds for the user
  const productIdToQueriesMap: { [key: number]: string[] } = {}; // Map to store queries by productId
  const productIdToReviewIdsMap: { [key: number]: number[] } = {}; // Map to store reviewIds by productId

  // Process queries for the user
  user.queries.forEach((query) => {
    const { productId, queryId } = query;
    productIdSet.add(productId!); // Add productId to the set of productIds for this user

    if (!productIdToQueriesMap[productId!]) {
      productIdToQueriesMap[productId!] = [];
    }
    productIdToQueriesMap[productId!].push(`${query.query}`);
  });

  // Process reviews for the user
  user.reviews.forEach((review) => {
    const { productId, reviewId } = review;
    productIdSet.add(productId); // Add productId to the set of productIds for this user

    if (!productIdToReviewIdsMap[productId]) {
      productIdToReviewIdsMap[productId] = [];
    }
    productIdToReviewIdsMap[productId].push(reviewId);
  });

  // Construct the rows for each productId
  productIdSet.forEach((productId) => {
    const queriesArray = productIdToQueriesMap[productId] || [];
    const reviewIdsArray = productIdToReviewIdsMap[productId] || [];

    tableData.push([productId, queriesArray, reviewIdsArray]);
  });

  console.log(tableData);
  return tableData;
  // return [["a", "b", "c"], ["a2", "b2", "c2"]];
}

async function generateEmbedding(body: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  body = body.replace("\n", " ");
  let embedding: number[] = (
    await client.embeddings.create({
      input: [body],
      model: "text-embedding-3-small",
      dimensions: 768,
    })
  ).data[0].embedding;
  return JSON.stringify(embedding);
}

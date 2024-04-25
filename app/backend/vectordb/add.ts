import { Review } from "../../globals";
import { chunk_string } from "../langchain/chunking";
import { generateEmbedding } from "./misc";

// Adders
export async function addReviewChunksToSingleStore(
  reviews: Review[]
): Promise<void> {
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
            [embedding, review.reviewId, i]
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
  reviews: Review[]
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
  query: string
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
        `
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
        `
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
        [semanticEmbdding, queryId]
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
  query: string
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
        `
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
        [semanticEmbdding, queryId]
      );

      console.log("Query added successfully.");
      return queryId;
    }
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function addCustomerSupportQueryToSinglestore(
  productId: number,
  userId: number,
  query: string
): Promise<void> {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
        INSERT INTO Customer_Support_Queries (
            productId,
            userId,
            query,
        ) VALUES (
            ${productId},
            ${userId},
            '${query.replace(/'/g, "\\'")}',
        )
        `
    );

    // only generate embedding if the query was added (this always happens for now, since queries aren't deduplicated)
    if ((results as any).affectedRows > 0) {
      const queryId = (results as any).insertId;

      // generate embedding and add to db
      const semanticEmbdding = await generateEmbedding(query);
      await singleStoreConnection.execute(
        `
          UPDATE Customer_Support_Queries
          SET semanticEmbedding = ?
          WHERE queryId = ?
        `,
        [semanticEmbdding, queryId]
      );

      console.log("Customer Support Query added successfully.");
      return queryId;
    }
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

export async function addCustomerSupportCorpusChunksToSingleStore(
  documents: string[]
): Promise<void> {
  let documentNumber = 1;
  for (const document of documents) {
    const chunks = await chunk_string(document, documentNumber);
    let chunkNumber = 1;
    for (const chunk of chunks) {
      try {
        const [results, buff] = await singleStoreConnection.execute(`
          INSERT IGNORE INTO Customer_Support_Corpus (
              documentId,
              chunkNumber,
              body,
              startIndex,
              endIndex
          ) VALUES (
              ${documentNumber},
              ${chunkNumber},
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
            UPDATE Customer_Support_Corpus
            SET chunkEmbedding = ?
            WHERE documentId = ? AND chunkNumber = ?
          `,
            [embedding, documentNumber, chunkNumber]
          );
          console.log("Chunk added successfully.");
        }
        chunkNumber += 1;
      } catch (err) {
        console.log("Error adding chunks");
        console.log(err);
        process.exit(1);
      }
    }
    documentNumber += 1;
  }
  console.log("Added chunks for all reviews");
}

// this is called whenever seller sets answer to a query, or whenever a query is answered by the agent and is similar enough to an existing query with an answer
export async function addAnswerToCustomerSupportQuery(
  queryId: number,
  answer: string
) {
  try {
    await singleStoreConnection.execute(
      `
        UPDATE Customer_Support_Queries
        SET answer = ?
        WHERE queryId = ?
      `,
      [answer, queryId]
    );
    console.log("Answer added successfully.");
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

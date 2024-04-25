import { RowDataPacket } from "mysql2/promise";
import { Query, Review, User } from "../../globals";
import { Chunk } from "../langchain/chunking";
import { generateTableData } from "./misc";

// Getters
export async function getReviewChunksInfo(
  reviewIDs: number[],
  chunkNumbers: number[]
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
        [reviewID, chunkNumber]
      );
      const body = JSON.parse(JSON.stringify(results as RowDataPacket[]))[0]
        ?.body;
      const startIndex = JSON.parse(
        JSON.stringify(results as RowDataPacket[])
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
  queryIds: number[]
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
        [queryId]
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
  productId: number
): Promise<{ queries: Query[] }> {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
            SELECT queryId, query, userId FROM Queries WHERE productId = ?
          `,
      [productId]
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
  console.log(output[0]);

  const tableDataMap: { [key: number]: any[][] } = {};
  const usersMap: { [key: number]: User } = {};
  for (const user of output) {
    const tableData = generateTableData(user);
    tableDataMap[user.userId] = tableData;
    usersMap[user.userId] = user;
  }

  return {
    allUsersData: output,
    tableDataMap: tableDataMap,
    usersMap: usersMap,
  };
}

export async function getUser(userId: number): Promise<{ user: User }> {
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
        productId: row.productId,
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
    let userName = "";
    for (const row of results2 as RowDataPacket[]) {
      userName = row.reviewerName;
      const review: Review = {
        reviewerName: row.reviewerName,
        productId: row.productId,
        reviewerExternalId: row.reviewerExternalId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        verified: row.verified,
        reviewId: row.reviewId,
        rating: row.rating,
        title: row.title,
        body: row.body,
      };
      reviews.push(review);
    }

    const user: User = {
      userId: userId,
      name: userName,
      queries: queries,
      reviews: reviews,
    };
    // console.log(user)
    // return { queries };
    return { user: user };
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

import { HashFormat, hashString } from "@shopify/shopify-api/runtime";
import { RowDataPacket } from "mysql2";
import { generateEmbedding } from "~/backend/vectordb/misc";
import { Segment } from "~/globals";

export enum PurchaseStatus {
  WINDOW, // queried, didn't add to cart
  ABANDONEDCART, // added to cart, didn't purchase
  PURCHASED,
}

export async function createSegment(
  purchaseStatus: PurchaseStatus,
  segmentName: string,
  productId: number = -1,
  semanticSegmentReview: string,
  semanticSegmentQuery: string,
  semanticSegmentCxQuery: string,
  overReviews: boolean,
  overQueries: boolean,
  overCxQueries: boolean
) {
  // Getting embedding for segment string

  const segmentUserIds: Set<number> = new Set();

  // Treating window and abandoned cart as the same for now
  if (overReviews) {
    const reviewSegmentEmbedding = await generateEmbedding(
      semanticSegmentReview
    );

    let [results, buff] = await singleStoreConnection.execute(
      `
        SET @query_vec = ('${reviewSegmentEmbedding}'):>VECTOR(768):>BLOB;

        SELECT r.reviewerExternalId, r.productId,
          DOT_PRODUCT(e.chunkEmbedding,@query_vec) AS similarity_score
        FROM Review r
        JOIN Purchases p ON r.productId = p.productId AND r.reviewerExternalId = p.userId
        JOIN Embeddings e ON r.reviewId = e.reviewId
        WHERE (p.purchased = ${purchaseStatus === undefined ? `0 OR p.purchased = 1)` : purchaseStatus === PurchaseStatus.ABANDONEDCART || purchaseStatus === PurchaseStatus.WINDOW ? `0)` : `1)`} ${productId == -1 ? "" : `AND r.productId = ${productId}`} 
        HAVING similarity_score > 0.4;
        `
    );
    const rows = results as RowDataPacket[];
    for (const row of JSON.parse(JSON.stringify(rows[1]))) {
      console.log("Row: ", row, row.reviewerExternalId);

      // just checking here if userId is dummy (this is actually redundant since all reviews are left by registered customers)
      console.log("Adding userId: ", row.reviewerExternalId);
      segmentUserIds.add(row.reviewerExternalId);
    }
  }

  if (overQueries) {
    const querySegmentEmbedding = await generateEmbedding(semanticSegmentQuery);
    console.log("purchase status:" + purchaseStatus);

    let [results, buff] = await singleStoreConnection.execute(
      `
      SET @query_vec = ('${querySegmentEmbedding}'):>VECTOR(768):>BLOB;
      
      SELECT q.userId, q.productId,
        DOT_PRODUCT(q.semanticEmbedding, @query_vec) AS similarity_score
      FROM Queries q
      JOIN Purchases p ON q.productId = p.productId AND q.userId = p.userId
      WHERE (p.purchased = ${purchaseStatus === undefined ? `0 OR p.purchased = 1)` : purchaseStatus === PurchaseStatus.ABANDONEDCART || purchaseStatus === PurchaseStatus.WINDOW ? `0)` : `1)`} ${productId == -1 ? "" : `AND r.productId = ${productId}`} 
      HAVING similarity_score > 0.4;

      `
    );

    const rows = results as RowDataPacket[];
    for (const row of JSON.parse(JSON.stringify(rows[1]))) {
      console.log("Row: ", row, row.userId);
      if (row.userId != hashString(row.productId, HashFormat.Base64)) {
        // just checking here if userId is dummy (this is actually redundant since all reviews are left by registered customers)
        console.log("Adding userId: ", row.userId);
        segmentUserIds.add(row.userId);
      }
    }
  }
  if (overCxQueries) {
    const cxQuerySegmentEmbedding = await generateEmbedding(
      semanticSegmentCxQuery
    );

    let [results, buff] = await singleStoreConnection.execute(
      `
        SET @query_vec = ('${cxQuerySegmentEmbedding}'):>VECTOR(768):>BLOB;
      
        SELECT cx.userId, cx.productId,
          DOT_PRODUCT(cx.semanticEmbedding, @query_vec) AS similarity_score
        FROM Customer_Support_Queries cx
        JOIN Purchases p ON cx.productId = p.productId AND cx.userId = p.userId
        WHERE (p.purchased = ${purchaseStatus === undefined ? `0 OR p.purchased = 1)` : purchaseStatus === PurchaseStatus.ABANDONEDCART || purchaseStatus === PurchaseStatus.WINDOW ? `0)` : `1)`} ${productId == -1 ? "" : `AND r.productId = ${productId}`} 
        HAVING similarity_score > 0.4;
        `
    );
    const rows = results as RowDataPacket[];
    for (const row of JSON.parse(JSON.stringify(rows[1]))) {
      console.log("Row: ", row, row.userId);
      if (row.userId != hashString(row.productId, HashFormat.Base64)) {
        // just checking here if userId is dummy (this is actually redundant since all reviews are left by registered customers)
        console.log("Adding userId: ", row.userId);
        segmentUserIds.add(row.userId);
      }
    }
  }
  if (!overReviews && !overQueries && !overCxQueries) {
    const [response, bufff] = await singleStoreConnection.execute(
      `
    SELECT u.userId, p.productId
    FROM Users u
    ${productId == -1 ? `JOIN Purchases p ON u.userId = p.userId` : `JOIN Purchases p ON ${productId} = p.productId AND u.userId = p.userId`}
    WHERE (p.purchased = ${purchaseStatus === undefined ? `0 OR p.purchased = 1)` : purchaseStatus === PurchaseStatus.ABANDONEDCART || purchaseStatus === PurchaseStatus.WINDOW ? `0)` : `1)`}  
      `
    );
    for (const row of response as RowDataPacket[]) {
      if (row.userId != hashString(row.productId, HashFormat.Base64)) {
        // just checking here if userId is dummy (this is actually redundant since all reviews are left by registered customers)
        console.log("Adding userId: ", row.userId);
        segmentUserIds.add(row.userId);
      }
    }
  }

  const segment: Segment = {
    purchaseStatus,
    segmentName,
    productId,
    semanticSegmentReview,
    semanticSegmentQuery,
    semanticSegmentCxQuery,
    overReviews,
    overQueries,
    overCxQueries,
    userIds: Array.from(segmentUserIds),
  };

  return segment;
}

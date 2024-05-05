import {
  addQueryToSingleStore,
  addSellerQueryToSingleStore,
} from "~/backend/vectordb/add";

export async function callCatalogSearchAgent(
  customerId: number = -1,
  productId: number = -1,
  email: string = "",
  query: string,
  isSeller: boolean = false
) {
  if (customerId === -1 && email === "") {
    console.error("ERROR: No customer ID or email provided.");
    return null;
  }
  try {
    // add query to queries table
    // TODO: figure out how to get queryID, productID

    console.log("Adding query to single store...");
    let queryId;
    let sellerQueryId;
    if (!isSeller) {
      queryId = await addQueryToSingleStore(
        productId,
        customerId,
        email,
        "TEST ANSWER",
        query
      );
    } else {
      sellerQueryId = await addSellerQueryToSingleStore(
        productId,
        customerId,
        "TEST ANSWER",
        query
      );
    }

    // TODO: Add semantic caching logic here
    console.log("Calling catalog search agent...");
    let allReviews;
    let productData;

    if (productId == -1) {
      allReviews = await langchain_db.run(
        `SELECT R.productId, R.reviewId, E.chunkNumber, E.body, DOT_PRODUCT(E.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
          FROM Review R CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query 
          JOIN Embeddings E ON R.reviewId = E.reviewId
          ORDER BY similarity_score DESC
          LIMIT 10;
          `
      );
      productData = await langchain_db.run(
        `SELECT P.productId, P.description, DOT_PRODUCT(P.embedding, Query.semanticEmbedding) AS similarity_score 
          FROM Products P CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query
          ORDER BY similarity_score DESC
          LIMIT 10;`
      );
    } else {
      allReviews = await langchain_db.run(
        `SELECT R.productId, R.reviewId, E.chunkNumber, E.body, DOT_PRODUCT(E.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
          FROM Review R CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query 
          JOIN Embeddings E ON R.reviewId = E.reviewId
          WHERE R.productId = ${productId}
          ORDER BY similarity_score DESC
          LIMIT 10;
          `
      );
      productData = await langchain_db.run(
        `SELECT P.productId, P.description, DOT_PRODUCT(P.embedding, Query.semanticEmbedding) AS similarity_score 
          FROM Products P CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query
          WHERE P.productId = ${productId}
          ORDER BY similarity_score DESC
          LIMIT 10;`
      );
    }

    let filteredReviews = JSON.parse(allReviews).filter(
      (r: any) => r.similarity_score > 0.45
    );

    // console.log(JSON.parse(productData));
    let filteredPdData = JSON.parse(productData).filter(
      (pd: any) => pd.similarity_score > 0.45
    );

    console.log("PD Search Agent Results:" + filteredPdData.length + "\n");
    console.log(
      "Reviews Search Agent Results:" + filteredReviews.length + "\n"
    );

    return {
      productDescriptionOutput: filteredPdData,
      reviewsOutput: filteredReviews,
    };
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

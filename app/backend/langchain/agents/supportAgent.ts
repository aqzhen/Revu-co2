import { json } from "@remix-run/node";
import { SqlDatabase } from "langchain/sql_db";
import { addCustomerSupportQueryToSinglestore } from "~/backend/vectordb/add";
import { call_ReviewsLLM } from "../llms/queryReviewsLLM";
import { Query } from "~/globals";

export async function callSupportAgent(
  userId: number = -1,
  productId: number = -1,
  query: string
) {
  try {
    // we will basically have two tables: customerSupportCorpus and customerSupportQueries

    // customerSupportCorpus is the knowledge base of all the information that the seller has uploaded as "customer support"
    // like the reviews table, this will be chunked and each chunk will have a unique number

    // customerSupportQueries will be the table that stores all the queries that previous customers have made to the agent. With each query, we will store queryId, productId, customerId, query, and answer.

    // For now, we will have basic functionality for a semantic caching layer that will check if the query is similar to one that has been made before. If it is, we will return the answer that was given before. We are setting the value of answer if the seller has specified an "automated" response for this specific semantic query. If answer is unset, there are no automated responses and the agent will be called to answer the query. Then, the user will be presented with the results of the agent's answer and supporting evidence. They then have the option to rate the answer and escalate to a ticket.

    // In the future, we want to support a semantic caching layer that is able to make seller-specified API calls. A good example of this is queries that ask about order status or tracking. Upon a query being semantically similar enough to e can make an API call to the seller's Shopify store to get the order status and tracking information.

    // Here's how the above will be implemented:

    // (1) with the incoming query, we will check if it is semantically similar to a query that has been made before in customerSupportQueries (which is prefiltered to only include rows with answer column set). If it is, we will return the answer that was given before, for the most similar query. If it is not, we will call the agent to attempt to answer the query.

    console.log("Adding query to single store...");
    let queryId;

    queryId = await addCustomerSupportQueryToSinglestore(
      productId,
      userId,
      query
    );

    // TODO: Add semantic caching logic here, for checking if similar query to one made before
    // if similar query, return answer from before
    // if not, call agent to answer query

    if (queryId !== undefined) {
      console.log("Calling semantic cache...");
      const queries = await langchain_db.run(
        `
        SELECT queryId, userId, query, answer,
            DOT_PRODUCT(Query.semanticEmbedding, Customer_Support_Queries.semanticEmbedding) AS similarity_score
        FROM Customer_Support_Queries
        CROSS JOIN (SELECT semanticEmbedding FROM Customer_Support_Queries WHERE queryId = ${queryId}) AS Query
        WHERE Customer_Support_Queries.queryId != ${queryId} AND Customer_Support_Queries.answer IS NOT NULL
        ORDER BY similarity_score DESC
        LIMIT 25;

        `
      );

      let filteredQueries = JSON.parse(queries).filter(
        (query: any) => query.similarity_score > 0.6
      );

      console.log("Semantic Cache Results:" + filteredQueries.length + "\n");

      // run the agent to search over the faq corpus
      console.log("Calling support agent...");
      const faqChunks = await langchain_db.run(
        `
        SELECT Customer_Support_Corpus.documentId, Customer_Support_Corpus.chunkNumber, Customer_Support_Corpus.body,
            DOT_PRODUCT(Customer_Support_Corpus.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
        FROM Customer_Support_Corpus
        CROSS JOIN (SELECT semanticEmbedding FROM Customer_Support_Queries WHERE queryId = ${queryId}) AS Query
        ORDER BY similarity_score DESC
        LIMIT 25;

        `
      );

      // WHERE Customer_Support_Corpus.productId = ${productId}

      let filteredChunks = JSON.parse(faqChunks).filter(
        (chunk: any) => chunk.similarity_score > 0.4
      );
      console.log("Agent Results:" + filteredChunks.length + "\n");
      // console.log("Cache output " + filteredQueries + "\n");
      // console.log("Agent output " + filteredChunks);

      // Parse filteredQueries and filteredChunks into HTML output
      let htmlOutput = "";
      htmlOutput += "<h2>Semantic Cache Output:</h2>";
      htmlOutput += "<ul>";
      filteredQueries.forEach((query: any) => {
        htmlOutput += `<div style="overflow-x: auto;">`;
        htmlOutput += `<div style="display: flex;">`;
        filteredQueries.forEach((query: any) => {
          htmlOutput += `<div style="border: 1px solid black; padding: 10px; margin: 10px;">`;
          htmlOutput += `<h3>Query ID: ${query.queryId}</h3>`;
          htmlOutput += `<p>User ID: ${query.userId}</p>`;
          htmlOutput += `<p>Query: ${query.query}</p>`;
          htmlOutput += `<p>Answer: ${query.answer}</p>`;
          htmlOutput += `<p>Similarity Score: ${query.similarity_score}</p>`;
          htmlOutput += `</div>`;
        });
        htmlOutput += `</div>`;
        htmlOutput += `</div>`;
      });
      htmlOutput += "</ul>";

      htmlOutput += "<h2>FAQ Agent Output:</h2>";
      htmlOutput += "<ul>";
      filteredChunks.forEach((chunk: any) => {
        htmlOutput += `<div style="overflow-x: auto;">`;
        htmlOutput += `<div style="display: flex;">`;
        filteredChunks.forEach((chunk: any) => {
          htmlOutput += `<div style="border: 1px solid black; padding: 10px; margin: 10px;">`;
          htmlOutput += `<h3>Document ID: ${chunk.documentId}</h3>`;
          htmlOutput += `<p>Chunk Number: ${chunk.chunkNumber}</p>`;
          htmlOutput += `<p>Body: ${chunk.body}</p>`;
          htmlOutput += `<p>Similarity Score: ${chunk.similarity_score}</p>`;
          htmlOutput += `</div>`;
        });
        htmlOutput += `</div>`;
        htmlOutput += `</div>`;
      });
      htmlOutput += "</ul>";
      return htmlOutput;
    }
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

export async function setAutomatedAnswer(queryIds: number[], answer: string) {
  try {
    for (let i = 0; i < queryIds.length; i++) {
      await singleStoreConnection.execute(
        `
        UPDATE Customer_Support_Queries
        SET answer = ?
        WHERE queryId = ?
      `,
        [answer, queryIds[i]]
      );

      console.log("Automated answer set.");
    }
  } catch (err) {
    console.error("ERROR", err);
  }
}

export async function sendAnswer(queries: Query[], answer: string) {}

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import fs from "fs";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { AIMessage } from "langchain/schema";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { addQueryToSingleStore, addSellerQueryToSingleStore } from "~/backend/vectordb/add";
import { prefix, suffix } from "./productAgentPrompt";
  let executor: AgentExecutor;
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
  });
  let db: SqlDatabase;

  export async function initializeCatalogSearchAgent() {
    try {
      const dataSource = new DataSource({
        type: "mysql",
        host: process.env.SINGLESTORE_HOST,
        port: 3333,
        username: process.env.SINGLESTORE_USER,
        password: process.env.SINGLESTORE_PASSWORD,
        database: process.env.SINGLESTORE_DATABASE,
        ssl: {
          ca: fs.readFileSync("./singlestore_bundle.pem"),
        },
      });
      db = await SqlDatabase.fromDataSourceParams({
        appDataSource: dataSource,
      });
      const toolkit = new SqlToolkit(db);
      const tools = toolkit.getTools();

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", prefix],
        // new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
        new AIMessage(suffix.replace("{agent_scratchpad}", "")),
        new MessagesPlaceholder("agent_scratchpad"),
      ]);
      // const memory = new BufferMemory({
      //   memoryKey: "chat_history",
      //   returnMessages: true,
      // }); // adding memory here

      const newPrompt = await prompt.partial({
        dialect: toolkit.dialect,
      });
      const runnableAgent = await createOpenAIToolsAgent({
        llm,
        tools,
        prompt: newPrompt,
      });
      executor = new AgentExecutor({
        agent: runnableAgent,
        tools,
        returnIntermediateSteps: true,
        verbose: false,
        // memory: memory,
      });
    } catch (err) {
      console.error("ERROR", err);
    }
  }

  export async function callCatalogSearchAgent(
    customerId: number = -1,
    productId: number = -1,
    query: string,
    isSeller: boolean = false
  ) {
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
          "TEST ANSWER",
          query,
        );
      } else {
        sellerQueryId = await addSellerQueryToSingleStore(
          productId,
          customerId,
          "TEST ANSWER",
          query,
        );
      }

      // TODO: Add semantic caching logic here
      console.log("Calling agent...");
      const allReviews = await db.run(
        `SELECT R.productId, R.reviewId, E.chunkNumber, E.body, DOT_PRODUCT(E.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
        FROM Review R CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query 
        JOIN Embeddings E ON R.reviewId = E.reviewId
        ORDER BY similarity_score DESC
        LIMIT 10;
        `
      )
      let filteredReviews = JSON.parse(allReviews).filter((r: any) => r.similarity_score > 0.4);

      const productData = await db.run(
        `SELECT P.productId, P.description, DOT_PRODUCT(P.embedding, Query.semanticEmbedding) AS similarity_score 
        FROM Products P CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query
        ORDER BY similarity_score DESC
        LIMIT 10;`
      )

      console.log(JSON.parse(productData));
      let filteredPdData = JSON.parse(productData).filter((pd: any) => pd.similarity_score > 0.3);


      return {productDescriptionOutput: filteredPdData, reviewsOutput: filteredReviews};
    } catch (err) {
      console.error("ERROR", err);
      return null;
    }
  }
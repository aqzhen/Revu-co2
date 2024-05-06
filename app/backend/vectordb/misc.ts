import fs from "fs";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { SqlDatabase } from "langchain/sql_db";
import mysql from "mysql2/promise";
import OpenAI from "openai";
import { DataSource } from "typeorm";
import { User } from "../../globals";

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

  // console.log(tableData);
  return tableData;
  // return [["a", "b", "c"], ["a2", "b2", "c2"]];
}

export async function generateEmbedding(body: string) {
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

export async function initializeDBconnections() {
  console.log("Connecting to SingleStore");
  try {
    let singleStoreConnection = await mysql.createConnection({
      host: process.env.SINGLESTORE_HOST,
      user: process.env.SINGLESTORE_USER,
      port: 3333,
      password: process.env.SINGLESTORE_PASSWORD,
      database: process.env.SINGLESTORE_DATABASE,
      ssl: {
        ca: fs.readFileSync("./singlestore_bundle.pem"),
      },
      multipleStatements: true,
    });
    console.log("You have successfully connected to SingleStore.");
    global.singleStoreConnection = singleStoreConnection;
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }

  console.log("Connecting to dbs to langchain");
  global.dataSource = new DataSource({
    type: "mysql",
    host: process.env.SINGLESTORE_HOST,
    port: 3333,
    username: process.env.SINGLESTORE_USER,
    password: process.env.SINGLESTORE_PASSWORD,
    database: process.env.SINGLESTORE_DATABASE,
    ssl: {
      ca: fs.readFileSync("./singlestore_bundle.pem"),
    },
    multipleStatements: true,
  });

  global.langchain_db = await SqlDatabase.fromDataSourceParams({
    appDataSource: dataSource,
  });

  global.toolkit = new SqlToolkit(global.langchain_db);
  global.tools = toolkit.getTools();
}

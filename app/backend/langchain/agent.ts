import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { json } from "@remix-run/node";
import fs from "fs";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { AIMessage } from "langchain/schema";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import {
  addQueryToSingleStore,
  addSellerQueryToSingleStore,
} from "../vectordb/helpers";
import { prefix, suffix } from "./agentPrompt";
import { queryProductDescription } from "./queryProductDescriptionLLM";
import { call_LLM } from "./queryReviewsLLM";

let executor: AgentExecutor;
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
});
let db: SqlDatabase;

export async function initialize_agent() {
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
      verbose: true,
      // memory: memory,
    });
  } catch (err) {
    console.error("ERROR", err);
  }
}

export async function call_agent(
  customerId: number = -1,
  productId: number = -1,
  query: string,
  isSeller: boolean = false,
  tableToQuery: string,
) {
  let response = {
    prompt: query,
    sqlQuery: "",
    result: [],
    error: "",
    output: "",
    productDescriptionOutput: "",
  };
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
    let result;
    if (queryId !== undefined) {
      result = await executor.invoke({
        input:
          "QueryId: " +
          queryId +
          ". Query the " +
          tableToQuery +
          " table. " +
          query +
          "for productId " +
          productId,
      });
    } else if (sellerQueryId !== undefined) {
      result = await executor.invoke({
        input:
          "SellerQueryId: " +
          sellerQueryId +
          ". Query the " +
          tableToQuery +
          " table. " +
          query +
          "for productId " +
          productId,
      }).catch((err) => { console.error(err); });
    }

    // TODO: Figure out if we can save tokens here by not returning all intermediate steps
    if (result) {
      result.intermediateSteps.forEach((step: any) => {
        if (step.action.tool === "query-sql") {
          response.prompt = query;
          response.sqlQuery = step.action.toolInput.input;
          response.result = step.observation;
        }
      });
      console.log(
        `Intermediate steps ${JSON.stringify(result.intermediateSteps, null, 2)}`,
      );
    }

    const llmOutput = await call_LLM(
      response.result as unknown as string,
      llm,
      db,
      query,
    );

    const productDescriptionOutput = await queryProductDescription(llm, query, productId);
    
    response.output = llmOutput as string;
    response.productDescriptionOutput = productDescriptionOutput.productDescriptionOutput;
    
    console.log(response.output);
    console.log(productDescriptionOutput);
    return json(response);
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

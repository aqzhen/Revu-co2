import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { json } from "@remix-run/node";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { AIMessage } from "langchain/schema";
import { SqlDatabase } from "langchain/sql_db";
import {
  addQueryToSingleStore,
  addSellerQueryToSingleStore,
} from "~/backend/vectordb/add";
import { prefix, suffix } from "./productAgentPrompt";
import { queryProductDescription } from "../queryProductDescriptionLLM";
import { call_ReviewsLLM } from "../queryReviewsLLM";

let executor: AgentExecutor;
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
});
let db: SqlDatabase;

export async function initializeProductAgent() {
  try {
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

export async function callProductAgent(
  customerId: number = -1,
  productId: number = -1,
  query: string,
  isSeller: boolean = false,
  tableToQuery: string
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
      result = await executor
        .invoke({
          input:
            "SellerQueryId: " +
            sellerQueryId +
            ". Query the " +
            tableToQuery +
            " table. " +
            query +
            "for productId " +
            productId,
        })
        .catch((err) => {
          console.error(err);
        });
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
        `Intermediate steps ${JSON.stringify(result.intermediateSteps, null, 2)}`
      );
    }

    const llmOutput = await call_ReviewsLLM(
      response.result as unknown as string,
      llm,
      db,
      query
    );

    const productDescriptionOutput = await queryProductDescription(
      llm,
      query,
      productId
    );

    response.output = llmOutput as string;
    response.productDescriptionOutput =
      productDescriptionOutput.productDescriptionOutput;

    console.log(response.output);
    console.log(productDescriptionOutput);
    return json(response);
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

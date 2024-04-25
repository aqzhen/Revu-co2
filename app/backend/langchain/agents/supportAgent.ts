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
import { prefix, suffix } from "./productAgentPrompt";
import { call_ReviewsLLM } from "../queryReviewsLLM";
import {
  addCustomerSupportCorpusChunksToSingleStore,
  addCustomerSupportQueryToSinglestore,
} from "~/backend/vectordb/add";

let executor: AgentExecutor;
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
});
let db: SqlDatabase;

export async function initialize_support_agent() {
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

export async function callSupportAgent(
  userId: number = -1,
  productId: number = -1,
  query: string
) {
  let response = {
    prompt: query,
    sqlQuery: "",
    result: [],
    error: "",
    output: "",
  };
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
    }

    console.log("Calling agent...");
    let result;
    if (queryId !== undefined) {
      result = await executor.invoke({
        input:
          "QueryId: " +
          queryId +
          ". Query the customerSupportCorpus table. " +
          query +
          "for productId " +
          productId,
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

    response.output = llmOutput as string;

    console.log(response.output);
    return json(response);
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

import { ChatOpenAI } from "@langchain/openai";
import { getProductDescription } from "../../api_calls";

export async function queryProductDescription(
  llm: ChatOpenAI,
  query: string,
  productId: number
): Promise<{ productDescriptionOutput: string }> {
  // parse result to perform additional queries and LLM calls
  // if results has reviewIds and similarity_score, then we perform query to grab bodies and feed into LLM
  const productDescription = await getProductDescription(productId);
  // console.log(productDescription.description);
  const llmOutput = (
    await llm.invoke(
      "Using the following product description, answer this query:  " +
        query +
        "\n" +
        productDescription.description +
        "\n. If the product description is not relevant to the query, please state that the product description is not relevant to the query."
    )
  ).content;

  return { productDescriptionOutput: llmOutput as string };
}

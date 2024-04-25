import { ChatOpenAI } from "@langchain/openai";
import { SqlDatabase } from "langchain/sql_db";

export async function call_ReviewsLLM(
  responseResult: string,
  llm: ChatOpenAI,
  db: SqlDatabase,
  query: string
): Promise<string | undefined> {
  // parse result to perform additional queries and LLM calls
  // if results has reviewIds and similarity_score, then we perform query to grab bodies and feed into LLM
  let llmOutput;
  const resultObject = JSON.parse(responseResult);
  console.log(resultObject);
  if (resultObject.length > 0 && (resultObject[0] as any).reviewId) {
    // get unique reviewIds of (reviewId, chunkNumber) pairs that have similarity score > 0.5
    let reviewIds = Array.from(
      new Set(
        resultObject
          .filter((r: any) => r.similarity_score >= 0.45)
          .map((r: any) => r.reviewId)
      )
    );

    // if there's nothing strongly similar enough, we will let the LLM decide if the "less relevant" info is useful
    if (reviewIds.length === 0) {
      reviewIds = Array.from(
        new Set(
          resultObject
            .filter((r: any) => r.similarity_score >= 0.35)
            .map((r: any) => r.reviewId)
        )
      );
    }
    const reviewIdsString = reviewIds.join(",");
    // get review bodies

    if (reviewIds.length === 0) {
      llmOutput = "No semantically similar reviews found.";
    } else {
      const reviewBodies = await db.run(
        `SELECT reviewId, body, reviewerExternalId FROM Review WHERE reviewId IN (${reviewIdsString})`
      );

      console.log(reviewBodies);

      llmOutput = (
        await llm.invoke(
          "Using the following reviews, answer this query, referencing the reviewID where you get your evidence from. You must reference every reviewID. If the original query referenced returning users, you must reference every reviewerExternalId:  " +
            query +
            "\n" +
            reviewBodies
        )
      ).content;
    }

    return llmOutput as string;
  } else if (resultObject.length > 0 && (resultObject[0] as any).queryId) {
    // get unique reviewIds of (reviewId, chunkNumber) pairs that have similarity score > 0.5
    let queryIds = Array.from(
      new Set(
        resultObject
          .filter((q: any) => q.similarity_score >= 0.5)
          .map((q: any) => q.queryId)
      )
    );

    // if there's nothing strongly similar enough, we will let the LLM decide if the "less relevant" info is useful
    if (queryIds.length === 0) {
      queryIds = Array.from(
        new Set(
          resultObject
            .filter((q: any) => q.similarity_score >= 0.35)
            .map((q: any) => q.queryId)
        )
      );
    }
    const queryIdsString = queryIds.join(",");
    // get review bodies

    if (queryIds.length === 0) {
      llmOutput = "No semantically similar queries found.";
    } else {
      const queryBodies = await db.run(
        `SELECT queryId, query FROM Queries WHERE queryId IN (${queryIdsString})`
      );

      console.log(queryBodies);

      llmOutput = (
        await llm.invoke(
          "Using the following evidence, answer this query, referencing the queryId where you get your evidence from. You must reference every queryId: " +
            query +
            "\n" +
            queryBodies
        )
      ).content;
    }

    return llmOutput as string;
  }

  return undefined;
}

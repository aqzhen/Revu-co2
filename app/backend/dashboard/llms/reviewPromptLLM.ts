import { ChatOpenAI } from "@langchain/openai";
import { ReviewPrompt } from "~/globals";

export async function call_reviewPromptLLM(userId: string): Promise<string[]> {
  // parse result to perform additional queries and LLM calls
  // if results has reviewIds and similarity_score, then we perform query to grab bodies and feed into LLM
  let llmOutput;
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
  });

  try {
    console.log("Generating review prompt for user id: ?", userId);
    const userQueries = await langchain_db.run(
      `SELECT queryId, query FROM Queries WHERE userId = ${userId}`
    );

    console.log("in the review prompt llm and printing users queries");
    // console.log(userQueries);

    llmOutput = (
      await llm.invoke(
        `Given the following queries that a user has made regarding this product,
            come up with 3 distinct and different questions to prompt the user for a review.
            The first question should be a rating of something on a 1-5 scale. The second question 
            should be a yes/no question, and the third question should be an open ended question
            about the product. 
            
            IMPORTANT: each of your questions should target a different aspect of the product, based
            on things the user has queried. 
            
            Example:\n
            
            User Queries: ["Is this board good for beginners?", "Is this product durable?", 
            "How is the design of the board?"]\n
            
            Output:\n
            1. Rate the durability of this product on a scale of 1-5.\n
            2. Would you say this board is good for beginners? (Yes/No)\n
            3. How would you describe the design of the board?\n
            
            Notice how each of these questions targets a different aspect of the user's wants when
            querying for the product. The first question targets the query about durability, the second question
            targets the query about beginners, and the third question targets the query about the design of the board.
            
            IMPORTANT: You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

      "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

      For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
      would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
      Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

      Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

      Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:

      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "questions": {
            "type": "array",
            "items": {
              "type": "string",
            },
            "minItems": 3,
            "uniqueItems": true
          }
        },
        "required": ["questions"],
        "description": "Schema for a review prompt containing an array of questions."
      }
      

      DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.` +
          "\n" +
          userQueries
      )
    ).content;

    console.log("in review prompt llm and printing llm output");
    // console.log(llmOutput as string);

    let llmOutputString = llmOutput as string;
    const startIndex = llmOutputString.indexOf("{");
    const endIndex = llmOutputString.lastIndexOf("}");
    llmOutputString = llmOutputString.substring(startIndex, endIndex + 1);

    // console.log(llmOutputString);

    const response = JSON.parse(llmOutputString);
    console.log("parsed json");
    // console.log(response);
    const questions: string[] = [];
    response.questions.forEach((element: string) => {
      questions.push(element);
    });
    // console.log(questions);
    return questions;
  } catch (err) {
    console.error("ERROR", err);
    return ["ERROR"];
  }
}

export async function getReviewPromptData(userIds: string[]): Promise<{
  reviewPromptData: ReviewPrompt[];
}> {
  const promises = userIds.map(async (userId) => {
    const llmOutput = await call_reviewPromptLLM(userId);
    const reviewPromptObj: ReviewPrompt = {
      userId: parseInt(userId),
      userName: "Test Name",
      questions: llmOutput as string[],
    };
    return reviewPromptObj;
  });

  const output = await Promise.all(promises);
  // console.log(output);
  return { reviewPromptData: output };
}

import { ChatOpenAI } from "@langchain/openai";
import fs from "fs";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { Category, Query, Review } from "~/globals";
import { getProductDescription } from "../../api_calls";
import { getQueryClusters } from "../stratify/queryClustering";

export async function call_windowShoppersInsightsLLM(
  productId: number,
  k?: number
) {
  // parse result to perform additional queries and LLM calls
  // if results has reviewIds and similarity_score, then we perform query to grab bodies and feed into LLM
  console.log("hello");
  let llmOutput;
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
  });
  let db: SqlDatabase;

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

    const userQueries = await db.run(
      `SELECT Q.queryId, Q.query, Q.userId
      FROM Queries Q
      JOIN Purchases P
      ON Q.userId = P.userId AND Q.productId = P.productId
      WHERE Q.productId = ${productId} AND P.purchased = 0
      `
    );

    console.log("in the sell side llm and printing users queries");
    // console.log(userQueries);

    const parsedUserQueries = JSON.parse(userQueries);

    const semanticEmbeddings = await db.run(
      `SELECT semanticEmbedding
      FROM Queries
      WHERE productId = ${productId} AND userId IN (SELECT userId FROM Purchases WHERE productId = ${productId} AND purchased = 0)
      `
    );

    const parsedSemanticEmbeddings = JSON.parse(semanticEmbeddings);

    const queryList: Query[] = parsedUserQueries.map(
      (query: any, index: number) => {
        return {
          queryId: query.queryId,
          query: query.query,
          userId: query.userId,
          semanticEmbedding: parsedSemanticEmbeddings[index].semanticEmbedding,
        };
      }
    );

    if (queryList.length == 0) {
      console.log("No queries");
      return null;
    }

    // Getting product description
    const productDescription = await getProductDescription(productId);
    const { description } = productDescription;
    // console.log(description);

    if (k && k > 1) {
      // Clustering Logic to get Query Categories
      const categoriesString = getQueryClusters(queryList, k);

      console.log(categoriesString);

      llmOutput = (
        await llm.invoke(
          `You are given the following queries that a user has made on a product. These users have not
          purchased the product. You are also given the categories that each queryId must fall under. The categories are given to you
          after the line "Categories:" \n 
          
          FIRST, you should analyze these queries and come up with an appropriate category name for each category
          which uniquely describe what the users were looking for in the product when querying. \n
  
          DO NOT MAKE UP QUERIES. ONLY USE THE QUERIES PROVIDED. THE QUERIES ARE GIVEN TO YOU AFTER THE LINE "User Queries:"
          IF YOU MAKE UP A QUERY, I RECREATE 9/11. Even if there are very few queries or just one, only use the queries provided please.
          
          YOU SHOULD USE EVERY SINGLE QUERY in some category.\n
          
          Additionally, for each category, output a small, digestable summary of the category and what the users' queries in this category mean.\n
          
          IMPORTANT: Provide 1 suggestion for how the seller should change their product description to better cater to this category
          of users. YOU MUST specifically point out what is lacking in the current product description and then provide a better
          alternative or addition. BE SPECIFIC AND USE THE PRODUCT DESCRIPTION GIVEN TO YOU. YOU MUST REFERENCE SOMETHING SPECIFIC FROM THE PRODUCT DESCRIPTION!!!!!\n
  
          IMPORTANT: You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
  
        "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
  
        For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
        would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
        Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.
  
        Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!
  
        Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
  
        DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.
  
        {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "category": {
                "type": "string",
                "description": "Represents the category of the query"
              },
              "queries": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "userId": {
                      "type": "string",
                      "description": "Represents the userId of the user who made this query"
                    },
                    "queryId": {
                      "type": "string",
                      "description": "Represents the queryId of this query"
                    },
                    "query": {
                      "type": "string",
                      "description": "Represents the body of this query"
                    }
                  },
                  "required": ["userId", "queryId", "query"],
                  "additionalProperties": false
                },
                "description": "Array of queries"
              },
              "summary": {
                "type": "string",
                "description": "Represents the summary of the queries"
              },
              "suggestions": {
                "type": "string",
                "description": "Represents suggestions related to the queries"
              }
            },
            "required": ["category", "queries", "summary", "suggestions"],
            "additionalProperties": false
          }
        }      
        ` +
            "\n. User Queries: " +
            userQueries +
            ". Product Description: " +
            productDescription +
            "\n. Categories: " +
            categoriesString
        )
      ).content;
    } else {
      llmOutput = (
        await llm.invoke(
          `You are given the following queries that a user has made on a product. These users have not
          purchased the product. \n 
          
          FIRST, you should analyze these queries and come up with an appropriate amount (1-5) of
          categories which uniquely describe what the users were looking for in the product when querying. \n
  
          DO NOT MAKE UP QUERIES. ONLY USE THE QUERIES PROVIDED. THE QUERIES ARE GIVEN TO YOU AFTER THE LINE "User Queries:"
          IF YOU MAKE UP A QUERY, I RECREATE 9/11. Even if there are very few queries or just one, only use the queries provided please.
          
          DO NOT make up categories that are not relevant to the specific queries from the users. THE only thing you should use in 
          making the categories is the specific queries from the users. 
          
          YOU SHOULD USE EVERY SINGLE QUERY in some category. IF A QUERY DOES NOT FALL UNDER A SPECIFIC CATEGORY, you can include in a 
          category called "UNCATEGORIZED"\n
          
          Additionally, for each category, output a small, digestable summary of the category and what the users' queries in this category mean.\n
          
          IMPORTANT: Provide 1 suggestion for how the seller should change their product description to better cater to this category
          of users. YOU MUST specifically point out what is lacking in the current product description and then provide a better
          alternative or addition. BE SPECIFIC AND USE THE PRODUCT DESCRIPTION GIVEN TO YOU. YOU MUST REFERENCE SOMETHING SPECIFIC FROM THE PRODUCT DESCRIPTION!!!!!\n
  
          IMPORTANT: You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
  
        "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
  
        For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
        would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
        Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.
  
        Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!
  
        Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
  
        DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.
  
        {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "category": {
                "type": "string",
                "description": "Represents the category of the query"
              },
              "queries": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "userId": {
                      "type": "string",
                      "description": "Represents the userId of the user who made this query"
                    },
                    "queryId": {
                      "type": "string",
                      "description": "Represents the queryId of this query"
                    },
                    "query": {
                      "type": "string",
                      "description": "Represents the body of this query"
                    }
                  },
                  "required": ["userId", "queryId", "query"],
                  "additionalProperties": false
                },
                "description": "Array of queries"
              },
              "summary": {
                "type": "string",
                "description": "Represents the summary of the queries"
              },
              "suggestions": {
                "type": "string",
                "description": "Represents suggestions related to the queries"
              }
            },
            "required": ["category", "queries", "summary", "suggestions"],
            "additionalProperties": false
          }
        }      
        ` +
            "\n. User Queries: " +
            userQueries +
            ". Product Description: " +
            productDescription
        )
      ).content;
    }

    let llmOutputString = llmOutput as string;
    const startIndex = llmOutputString.indexOf("[");
    const endIndex = llmOutputString.lastIndexOf("]");
    llmOutputString = llmOutputString.substring(startIndex, endIndex + 1);

    console.log(llmOutputString);

    const response = JSON.parse(llmOutputString as string);

    const categories: Category[] = [];
    if (response.length > 0) {
      response.forEach(
        (element: {
          category: any;
          summary: any;
          suggestions: any;
          queries: { queryId: any; query: any; userId: any }[];
        }) => {
          let name = element.category;
          let summary = element.summary;
          let suggestions = element.suggestions;
          let queries: Query[] = [];
          element.queries.forEach(
            (query: { queryId: any; query: any; userId: any }) => {
              let q: Query = {
                queryId: query.queryId,
                query: query.query,
                userId: query.userId,
              };
              queries.push(q);
            }
          );

          let c: Category = {
            category: name,
            queries: queries,
            summary: summary,
            suggestions: suggestions,
          };
          categories.push(c);
        }
      );
    }

    let insightsString = (
      await llm.invoke(
        `You are given queries from users who did not purchase this proudct. You are also given the product description
        for this product. You are also given the categories of these queries which have been already identified.

        Based only on the queries, reviews, and product description, output a one paragraph summary which explains what
        these users were looking for (based on queries) and EXACTLY what the seller could change about their product description to alieviate discrpencies between queries and reviews.

        You should give very specific suggestions as to how to change the product description. 

        EXAMPLE: The product description for [Product Name] does not mention xyz. Here are some possible rewordings to the product description which targets category x:
        - change "xxxx" to "yyyy"

        YOU MUST GIVE AT LEAST 3 CONCRETE SUGGESTIONS

        YOU MUST ALSO OUTPUT AT LEAST 3 KEYWORDS
        These keywords should be words that the seller should include in their product description which target these queries

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
          "insights": {
            "type": "string",
            "description": "User-wide insights"
          },
          "suggestions": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "description": "A specific suggestion for the seller"
            },
            "minItems": 3,
            "description": "List of concrete suggestions for the seller"
          },
          "keywords": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "description": "A keyword relevant to the queries"
            },
            "minItems": 3,
            "description": "List of keywords relevant to the queries"
          }
        },
        "required": ["insights", "suggestions", "keywords"]
      }
      
      DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.
  
        ` +
          "\n" +
          userQueries +
          ". Product Description: " +
          productDescription
      )
    ).content;

    insightsString = insightsString as string;
    console.log(insightsString);
    const start = insightsString.indexOf("{");
    const end = insightsString.lastIndexOf("}");
    insightsString = insightsString.substring(start, end + 1);

    let insightsJson = JSON.parse(insightsString);
    const { insights, suggestions, keywords } = insightsJson;

    console.log(
      "\n-------------------------------\n",
      insights,
      "\n-------------------------------\n",
      suggestions,
      keywords
    );
    const keywordsString = (keywords as string[]).join(", ");
    console.log(keywordsString);

    return {
      categories: response,
      userWideInsights: insights,
      userWideSuggestions: suggestions,
      keywords: keywordsString,
    };
  } catch (err) {
    console.error("ERROR", err);
    return "ERROR";
  }
}

export async function call_purchasingCustomersInsightsLLM(
  productId: number,
  k?: number
) {
  // parse result to perform additional queries and LLM calls
  // if results has reviewIds and similarity_score, then we perform query to grab bodies and feed into LLM
  let llmOutput;
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
  });
  let db: SqlDatabase;

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

    const userQueries = await db.run(
      `SELECT Q.queryId, Q.query, Q.userId
      FROM Queries Q
      JOIN Purchases P
      ON Q.userId = P.userId AND Q.productId = P.productId
      WHERE Q.productId = ${productId} AND P.purchased = 1
      `
    );

    console.log("in the sell side llm and printing users queries");
    // console.log(userQueries);

    const parsedUserQueries = JSON.parse(userQueries);

    const semanticEmbeddings = await db.run(
      `SELECT semanticEmbedding
      FROM Queries
      WHERE productId = ${productId} AND userId IN (SELECT userId FROM Purchases WHERE productId = ${productId} AND purchased = 1)
      `
    );

    const parsedSemanticEmbeddings = JSON.parse(semanticEmbeddings);

    const queryList: Query[] = parsedUserQueries.map(
      (query: any, index: number) => {
        return {
          queryId: query.queryId,
          query: query.query,
          userId: query.userId,
          semanticEmbedding: parsedSemanticEmbeddings[index].semanticEmbedding,
        };
      }
    );

    if (queryList.length === 0) {
      console.log("here");
      return "There are no queries yet!";
    }

    const userReviews = await db.run(
      `SELECT R.reviewId, R.productID, R.reviewerName, R.reviewerExternalId, R.createdAt, R.updatedAt, R.verified, R.rating, R.title, R.body
      FROM Review R
      JOIN Purchases P
      ON R.reviewerExternalId = P.userId AND R.productId = P.productId
      WHERE R.productId = ${productId} AND P.purchased = 1
      `
    );

    console.log("in the sell side llm and printing users reviews");
    // console.log(userReviews);
    const parsedUserReviews = JSON.parse(userReviews);
    const reviewList: Review[] = parsedUserReviews.map((review: any) => {
      return {
        reviewId: review.reviewId,
        productId: review.productId,
        reviewerName: review.reviewerName,
        reviewerExternalId: review.reviewerExternalId,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        verified: review.verified,
        rating: review.rating,
        title: review.title,
        body: review.body,
      };
    });

    const productDescription = await getProductDescription(productId);

    if (k && k > 1) {
      // Clustering Logic to get Query Categories
      const categoriesString = getQueryClusters(queryList, k);

      // console.log(categoriesString);

      llmOutput = (
        await llm.invoke(
          `
        You are given the following queries that a user has made on a product. These users have 
        purchased the product. You are also given the categories that each queryId must fall under. The categories are given to you
        after the line "Categories:" \n 
        
        FIRST, you should analyze these queries and come up with an appropriate category name for each category
        which uniquely describe what the users were looking for in the product when querying. \n
        
        YOU SHOULD USE EVERY SINGLE QUERY in some category."\n
        
        Additionally, for each category, output a small, digestable summary of the category and what the users' queries in this category mean.\n

        Next, you are also given the reviews of the users who purchased the product. You should analyze these reviews and come up with insights on 
        what the users thought of the product, especially in relation to the queries they made. \n
        
        IMPORTANT: Provide 1 suggestion for how the seller should change their product description to better cater to this category
        of users. YOU MUST specifically point out what is lacking in the current product description and then provide a better
        alternative or addition. BE SPECIFIC AND USE THE PRODUCT DESCRIPTION GIVEN TO YOU. YOU MUST REFERENCE SOMETHING SPECIFIC FROM THE PRODUCT DESCRIPTION!!!!!\n

        IMPORTANT: You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

      "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

      For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
      would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
      Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

      Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

      Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:

      DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.

      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "category": {
              "type": "string",
              "description": "Represents the category of the query. This is also where your analysis of the review data should be included"
            },
            "queries": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "userId": {
                    "type": "string",
                    "description": "Represents the userId of the user who made this query"
                  },
                  "queryId": {
                    "type": "string",
                    "description": "Represents the queryId of this query"
                  },
                  "query": {
                    "type": "string",
                    "description": "Represents the body of this query"
                  }
                },
                "required": ["userId", "queryId", "query"],
                "additionalProperties": false
              },
              "description": "Array of queries"
            },
            "summary": {
              "type": "string",
              "description": "Represents the summary of the queries"
            },
            "suggestions": {
              "type": "string",
              "description": "Represents suggestions related to the queries"
            }
          },
          "required": ["category", "queries", "summary", "suggestions"],
          "additionalProperties": false
        }
      }      
      ` +
            "\n" +
            userQueries +
            userReviews +
            ". Product Description: " +
            productDescription +
            ". Categories: " +
            categoriesString
        )
      ).content;
    } else {
      llmOutput = (
        await llm.invoke(
          `You are given the following queries that a user has made on a product. These users have
          purchased the product. \n 
          
          FIRST, you should analyze these queries and come up with an appropriate amount (1-5) of
          categories which uniquely describe what the users were looking for in the product when querying. \n
          
          DO NOT make up categories that are not relevant to the specific queries from the users. THE only thing you should use in 
          making the categories is the specific queries from the users. 
          
          YOU SHOULD USE EVERY SINGLE QUERY in some category. IF A QUERY DOES NOT FALL UNDER A SPECIFIC CATEGORY, you can include in a 
          category called "UNCATEGORIZED"\n
          
          Additionally, for each category, output a small, digestable summary of the category and what the users' queries in this category mean.\n
          
          IMPORTANT: Provide 1 suggestion for how the seller should change their product description to better cater to this category
          of users. YOU MUST specifically point out what is lacking in the current product description and then provide a better
          alternative or addition. BE SPECIFIC AND USE THE PRODUCT DESCRIPTION GIVEN TO YOU. YOU MUST REFERENCE SOMETHING SPECIFIC FROM THE PRODUCT DESCRIPTION!!!!!\n
  
          IMPORTANT: You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
  
        "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
  
        For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
        would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
        Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.
  
        Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!
  
        Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
  
        DO NOT INCLUDE anything other that the json output. DO NOT INCLUDE the word 'json' at the start of your output or any QUOTES.
  
        {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "category": {
                "type": "string",
                "description": "Represents the category of the query"
              },
              "queries": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "userId": {
                      "type": "string",
                      "description": "Represents the userId of the user who made this query"
                    },
                    "queryId": {
                      "type": "string",
                      "description": "Represents the queryId of this query"
                    },
                    "query": {
                      "type": "string",
                      "description": "Represents the body of this query"
                    }
                  },
                  "required": ["userId", "queryId", "query"],
                  "additionalProperties": false
                },
                "description": "Array of queries"
              },
              "summary": {
                "type": "string",
                "description": "Represents the summary of the queries"
              },
              "suggestions": {
                "type": "string",
                "description": "Represents suggestions related to the queries"
              }
            },
            "required": ["category", "queries", "summary", "suggestions"],
            "additionalProperties": false
          }
        }      
        ` +
            "\n" +
            userQueries +
            userReviews +
            ". Product Description: " +
            productDescription
        )
      ).content;
    }

    let llmOutputString = llmOutput as string;
    // console.log(llmOutputString);

    const startIndex = llmOutputString.indexOf("[");
    const endIndex = llmOutputString.lastIndexOf("]");
    llmOutputString = llmOutputString.substring(startIndex, endIndex + 1);

    const response = JSON.parse(llmOutputString as string);
    // console.log("JSON response");
    // console.log(response);

    const categories: Category[] = [];
    response.forEach(
      (element: {
        category: any;
        summary: any;
        suggestions: any;
        queries: { queryId: any; query: any; userId: any }[];
      }) => {
        let name = element.category;
        let summary = element.summary;
        let suggestions = element.suggestions;
        let queries: Query[] = [];
        element.queries.forEach(
          (query: { queryId: any; query: any; userId: any }) => {
            let q: Query = {
              queryId: query.queryId,
              query: query.query,
              userId: query.userId,
            };
            queries.push(q);
          }
        );

        let c: Category = {
          category: name,
          queries: queries,
          summary: summary,
          suggestions: suggestions,
        };
        categories.push(c);
      }
    );

    // console.log(categories);

    const userWideInsights = (
      await llm.invoke(
        `You are given queries and reviews from users who purchased this proudct. You are also given the product description
        for this product.

        Based only on the queries, reviews, and product description, output a one paragraph summary which explains what
        these users were looking (based on queries), what they thought of the product (based on reviews), and ultimately
        what the seller could change about their product description to alieviate discrpencies between queries and reviews.

  
        ` +
          "\n" +
          userQueries +
          userReviews +
          ". Product Description: " +
          productDescription
      )
    ).content;

    // console.log(userWideInsights);

    return {
      categories: response,
      userWideInsights: userWideInsights as string,
    };
  } catch (err) {
    console.error("ERROR", err);
    return "ERROR";
  }
}

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  BlockStack,
  Button,
  Card,
  DataTable,
  Page,
  RangeSlider,
  Tabs
} from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import { getProducts } from "../backend/api_calls";
import { parseReviewsData } from "../metafield_parsers/judge";
import { authenticate } from "../shopify.server";
// import { addReviewsToDatabase } from "./backend/prisma/helpers";
import { initialize_agent } from "../backend/langchain/agent";
import { Chunk } from "../backend/langchain/chunking";
import {
  connectToSingleStore,
  createEmbeddingsTable,
  createPurchasesTable,
  createQueriesTable,
  createReviewTable,
  createSellerQueriesTable,
  getAllUsers,
  updatePurchasedStatus
} from "../backend/vectordb/helpers";
import { Category, Query, Review, ReviewPrompt, User } from "../globals";

// trigger action to get reviews
const initializeReviews = async (
  domain: string,
  pushReviews: boolean = false,
) => {
  const reviewHashMap: { [key: number]: Review[] } = {};
  const requestData = {};
  try {
    console.log("Fetching reviews");

    const response = await fetch(`https://${domain}/reviews/fetchAll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    // Handle the response from the API
    var parsedData = parseReviewsData(data.reviews);

    if (pushReviews) pushReviewsToDatabase(domain, parsedData);

    parsedData.forEach((review: Review) => {
      const productId = review.productId;
      if (reviewHashMap[productId]) {
        reviewHashMap[productId].push(review);
      } else {
        reviewHashMap[productId] = [review];
      }
    });

    return reviewHashMap;
  } catch (error) {
    // Handle any errors
    console.error(error);
  }
};

const pushReviewsToDatabase = async (domain: string, reviews: Review[]) => {
  const requestData = {
    reviews: reviews,
  };
  try {
    const response = await fetch(`https://${domain}/reviews/pushToDatabase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });
  } catch (error) {
    // Handle any errors
    console.error(error);
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const domain = new URL(request.url).hostname;
  const { admin } = await authenticate.admin(request);
  global.admin = admin;

  console.log("Connecting to SingleStore");
  const db = await connectToSingleStore();

  await createReviewTable(false);
  await createQueriesTable(false);
  await createEmbeddingsTable(false);
  await createSellerQueriesTable(false);
  await createPurchasesTable(false);

  await updatePurchasedStatus();

  await initialize_agent();
  const reviewsHashmap = await initializeReviews(domain, false);

  const {allUsersData, tableDataMap, usersMap} = await getAllUsers();

  console.log("Loading products");
  const productData = await (await getProducts()).json();

  return {
    reviewsHashmap,
    productData,
    allUsersData,
    tableDataMap,
    usersMap
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {};

// TODO: edit this function to highlight chunks within reviews
function chunksToReviews(chunks: Chunk[]) {
  return chunks.map((chunk: Chunk, index: number) => (
    <Card key={index}>{chunks[index] && <p>{chunks[index].chunkBody}</p>}</Card>
  ));
}

export default function Index() {
  // Loader Data
  const loaderData = useLoaderData<typeof loader>();

  // Miscellanous
  var [selectedTab, setSelectedTab] = useState<number>(0);
  const [sliderRangeValue, setsliderRangeValue] = useState(8);

  // Products
  const [products, setProducts] = useState<any[]>([]);
  var [selectedProduct, setSelectedProduct] = useState<number>();

  // Users
  var [allUsersData, setAllUsersData] = useState<User[]>(loaderData.allUsersData);

  // Reviews
  var [reviewListDetails, setReviewListDetails] = useState<Review[]>([]); // used to store the entire list of reviews for a product
  // var [chunkBodies, setChunkBodies] = useState<string[]>([]); // used to store the list of reviews returned on a query

  // Queries
  var [queriesListDetails, setQueriesListDetails] = useState<Query[]>([]); // used to store the entire list of queries for a product

  // Agent Calls
  var [resultQueries, setResultQueries] = useState<string[]>([]); // used to store the list of queries returned on a query. TODO: change to Query type
  var [resultChunks, setResultChunks] = useState<Chunk[]>([]);

  var [agentQuery, setAgentQuery] = useState<string>("");
  var [reviewAgentResponse, setReviewAgentResponse] = useState<string>(); // this is the LLM output text answer
  var [queryAgentResponse, setQueryAgentResponse] = useState<string>(); // this is the LLM output text answer
  var [agentResult, setAgentResult] = useState<string>(); // this is the sql query result (resultIds, etc..)
  var [agentSqlQuery, setAgentSqlQuery] = useState<string>("");

  // Followups
  var [reviewPromptData, setReviewPromptData] = useState<any[]>([]);
  var [reviewPromptDataTest, setReviewPromptDataTest] = useState<ReviewPrompt[]>([]);
  var [sentStatus, setSentStatus] = useState<boolean[]>([]);
  var [categorySentStatus, setCategorySentStatus] = useState<boolean[]>([]);
  // var [editedQuestions, setEditedQuestions] = useState<string[][]>([]);

  // Sellside Insights - Window Shoppers
  var [windowCategories, setWindowCategories] = useState<Category[]>([]);
  var [windowInsights, setWindowInsights] = useState<string>("");
  var [windowSuggestions, setWindowSuggestions] = useState<string[]>([]);
  var [windowKeywords, setWindowKeywords] = useState<string>("");

  // Sellside Insights - Purchasing Customers
  var [purchasingCustomersInsights, setPurchasingCustomersInsights] = useState<string>("");
  var [purchasingCustomersQueries, setPurchasingCustomersQueries] = useState<Query[]>([]);
  var [purchasingCustomersReviews, setPurchasingCustomersReviews] = useState<Review[]>([]);
  var [purchasingCustomersCategories, setPurchasingCustomersCategories] = useState<Category[]>([]);

  const nav = useNavigation();
  const isLoading =
    ["loading", "submitting"].includes(nav.state) && nav.formMethod === "POST";
  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );


  const tabs = [
    {
      id: "window-shoppers-1",
      content: "Window Shoppers",
      accessibilityLabel: "Window Shoppers",
      panelID: "window-shoppers-content-1",
    },
    {
      id: "purchasing-customers-1",
      content: "Purchasing customers",
      panelID: "purchasing-customers-content-1",
    },
    {
      id: "followups-1",
      content: "Followups",
      panelID: "followups-content-1",
    },
    {
      id: "reviews-1",
      content: "Reviews",
      panelID: "reviews-content-1",
    },
    {
      id: "queries-1",
      content: "Queries",
      panelID: "queries-content-1",
    },
    {
      id: "users-1",
      content: "Users",
      panelId: "users-content-1"
    }
  ];


  // calling api to get reviews for returned reviews/chunks after a query
  const reviewIds: number[] = [];
  const chunkNumbers: number[] = [];
  const queryIds: number[] = [];
  useEffect(() => {
    if (agentResult) {
      // TODO: Case on the queryResult to determine if it is query on reviews or queries
      const parsedResult = JSON.parse(agentResult as string);

      if (parsedResult.length > 0 && parsedResult[0].reviewId) {
        parsedResult.forEach((obj: any) => {
          reviewIds.push(obj.reviewId);
          chunkNumbers.push(obj.chunkNumber);
        });
        getReviewsForQuery(reviewIds, chunkNumbers);
      } else if (parsedResult.length > 0 && parsedResult[0].queryId) {
        parsedResult.forEach((obj: any) => {
          queryIds.push(obj.queryId);
        });
        getQueriesForQuery(queryIds);
      }
    }
  }, [agentResult]);

  const initializeQueries = async (selectedProductId: Number) => {
    const requestData = {
      productId: selectedProductId,
    };
    try {
      const response = await fetch("/queries/fetchAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      // Handle the response from the API
      setQueriesListDetails(data.queries);
    } catch (error) {
      // Handle any errors
      console.error(error);
    }
  };

  const initializeUsers = async () => {
    const requestData = {};
    try {
      console.log("Fetching users");
      const response = await fetch(`/queries/fetchAll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
  
      const data = await response.json();
  
      // Handle the response from the API
      
  
      return null;
    } catch (error) {
      // Handle any errors
      console.error(error);
    }
  };

  const getReviewsForQuery = async (
    reviewIds: number[],
    chunkNumbers: number[],
  ) => {
    const requestData = {
      reviewIds: reviewIds,
      chunkNumbers: chunkNumbers,
    };
    try {
      const response = await fetch("/reviews/getChunks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      // Handle the response from the API
      setResultChunks(data?.chunks);
    } catch (error) {
      // Handle any errors
      console.error(error);
    }
  };

  const getQueriesForQuery = async (queryIds: number[]) => {
    const requestData = {
      queryIds: queryIds,
    };
    try {
      const response = await fetch("/queries/getReturnedQueries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      // Handle the response from the API
      setResultQueries(data?.queries);
    } catch (error) {
      // Handle any errors
      console.error(error);
    }
  };

  const handleRangeSliderChange = useCallback(
    (value: number) => setsliderRangeValue(value),
    [],
  );
  const handleQuestionChange = (reviewIndex: number, questionIndex: number, newValue: string) => {
    const updatedQuestions = [...reviewPromptDataTest];
    updatedQuestions[reviewIndex].questions[questionIndex] = newValue;
    setReviewPromptDataTest(updatedQuestions);
  };
  
  const handleSend = (reviewIndex : number) => {
    sentStatus[reviewIndex] = !sentStatus[reviewIndex]
  };

  useEffect(() => {
    if (loaderData?.productData?.products?.length > 0) {
      setProducts(
        loaderData.productData.products.map((edge: any) => ({
          id: edge?.node?.id,
          title: edge?.node?.title,
          imageUrl: edge?.node?.images?.edges?.[0]?.node?.url,
        })),
      );
    }
  }, []);

  // set selected product
  const handleProductSelection = async (productId: string) => {
    var trimmed_id = productId.replace("gid://shopify/Product/", "");
    setSelectedProduct(Number(trimmed_id));
    initializeQueries(Number(trimmed_id));
    console.log(loaderData.reviewsHashmap);
    const reviews = loaderData?.reviewsHashmap ?? {};
    setReviewListDetails(reviews[Number(trimmed_id)]);
    console.log(reviews[Number(trimmed_id)]);
  };

  return (
    <Page fullWidth={true}>
      <div style={{ display: "flex", height: "100vh" }}>
        {
          <div style={{ flex: "1 1 20%", marginRight: "20px" }}>
            <Card>
              <DataTable
                columnContentTypes={["text", "text"]}
                headings={["Title", "Image"]}
                rows={products.map((product) => [
                  <Button onClick={() => handleProductSelection(product.id)}>
                    {product.title}
                  </Button>,
                  // product.id,
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    style={{ width: "50px", height: "auto" }}
                  />,
                ])}
              />
            </Card>
          </div>
        }

        <div style={{ flex: "1 1 80%" }}>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Card>
              <p>Selected Product ID: {selectedProduct}</p>
              {selectedProduct ? null : (
                <p style={{ color: "red" }}>Please select a product</p>
              )}
            </Card>

            <Card>
              {selectedTab === 0 && (
                <>
                  <RangeSlider
                    label="Toggle Category Granularity (Select 1 for auto-granularity)"
                    value={sliderRangeValue}
                    min={1}
                    max={10}
                    onChange={handleRangeSliderChange}
                    output
                  />
                  <Button
                    onClick={async () => {
                      try {
                        const requestData = {
                          productId: selectedProduct,
                          selector: "windowShoppers",
                          k: sliderRangeValue,
                        };

                        const response = await fetch(
                          "/agent/sellSideInsights",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(requestData),
                          },
                        );
                        const data = await response.json();
                        const {
                          categories,
                          userWideInsights,
                          userWideSuggestions,
                          keywords,
                        } = data;
                        setWindowCategories(categories);
                        setWindowInsights(userWideInsights);
                        setWindowSuggestions(userWideSuggestions);
                        setWindowKeywords(keywords);
                      } catch (error) {
                        // Handle any errors
                        console.error(error);
                      }
                    }}
                  >
                    Get Insights
                  </Button>
                  {windowInsights && (
                    <>
                      <div>
                        <br />
                        <h1
                          style={{
                            fontFamily: "Arial, sans-serif",
                            color: "#0077b6",
                            fontSize: 20,
                          }}
                        >
                          <strong>User-Wide Insights</strong>
                        </h1>
                        <p> {windowInsights} </p>
                        <br />
                        {windowSuggestions && (
                          <>
                            <h1
                              style={{
                                fontFamily: "Arial, sans-serif",
                                color: "red",
                                fontSize: 16,
                              }}
                            >
                              <strong>Action Items</strong>
                            </h1>
                            {windowSuggestions.map((suggestion, index) => (
                              <div key={index}>
                                <p>{suggestion}</p>
                              </div>
                            ))}
                            <br />
                            <p>
                              <strong
                                style={{ color: "green", fontWeight: "bold" }}
                              >
                                Keywords:{" "}
                              </strong>{" "}
                              {windowKeywords}
                            </p>
                          </>
                        )}
                      </div>
                      <br />
                    </>
                  )}
                  {windowCategories &&
                    windowCategories.map((category) => (
                      <Card>
                        {
                          <div key={category.category}>
                            <h1
                              style={{
                                fontFamily: "Arial, sans-serif",
                                color: "#0077b6",
                                fontSize: 16,
                              }}
                            >
                              <strong>Category:</strong> {category.category}{" "}
                            </h1>
                            <br />
                            <p>
                              {" "}
                              <strong>Summary:</strong> {category.summary}{" "}
                            </p>
                            <br />
                            <p>
                              {" "}
                              <strong>Suggestions:</strong>{" "}
                              {category.suggestions}
                            </p>
                            <br />
                            <details>
                              <summary> See Relevant Queries </summary>
                              {category.queries.map((query) => (
                                <div key={query.queryId}>
                                  <p>
                                    {" "}
                                    <strong>Query: </strong> {query.query}{" "}
                                    (Query ID: {query.queryId}, User ID:{" "}
                                    {query.userId})
                                  </p>
                                </div>
                              ))}
                            </details>
                            <br />
                          </div>
                        }
                      </Card>
                    ))}
                </>
              )}
              {selectedTab === 1 && (
                <>
                  <RangeSlider
                    label="Toggle Category Granularity (Select 1 for auto-granularity)"
                    value={sliderRangeValue}
                    min={1}
                    max={10}
                    onChange={handleRangeSliderChange}
                    output
                  />
                  <Button
                    onClick={async () => {
                      try {
                        const requestData = {
                          productId: selectedProduct,
                          selector: "purchasingCustomers",
                          k: sliderRangeValue,
                        };

                        const response = await fetch(
                          "/agent/sellSideInsights",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(requestData),
                          },
                        );
                        const data = await response.json();
                        const { categories, userWideInsights } = data;
                        setPurchasingCustomersInsights(userWideInsights);
                        setPurchasingCustomersCategories(categories);
                      } catch (error) {
                        // Handle any errors
                        console.error(error);
                      }
                    }}
                  >
                    Get Insights
                  </Button>
                  <div>
                    <br />
                    <h1
                      style={{
                        fontFamily: "Arial, sans-serif",
                        color: "#0077b6",
                        fontSize: 16,
                      }}
                    >
                      <strong>User-Wide Insights</strong>
                    </h1>
                    <p> {purchasingCustomersInsights} </p>
                  </div>
                  <br />
                  {purchasingCustomersCategories &&
                    purchasingCustomersCategories.map((category, categoryIndex) => (
                      <Card>
                        {
                          <div key={category.category}>
                            <h1
                              style={{
                                fontFamily: "Arial, sans-serif",
                                color: "#0077b6",
                                fontSize: 16,
                              }}
                            >
                              <strong>Category:</strong> {category.category}{" "}
                            </h1>
                            <br />
                            <p>
                              {" "}
                              <strong>Summary:</strong> {category.summary}{" "}
                            </p>
                            <br />
                            <p>
                              {" "}
                              <strong>Suggestions:</strong>{" "}
                              {category.suggestions}
                            </p>
                            <br />
                            <details>
                              <summary> See Relevant Queries </summary>
                              {category.queries.map((query) => (
                                <div key={query.queryId}>
                                  <p>
                                    {" "}
                                    <strong>Query: </strong> {query.query}{" "}
                                    (Query ID: {query.queryId}, User ID:{" "}
                                    {query.userId})
                                  </p>
                                </div>
                              ))}
                            </details>
                            <br />
                            <Button
                              onClick={async () => {
                                try {
                                  const userIds: Set<number> = new Set();
                                  category.queries.forEach((query) =>
                                    userIds.add(query.userId),
                                  );
                                  const requestData = {
                                    userIds: Array.from(userIds),
                                  };
                                  const response = await fetch(
                                    "/prompts/getReviewPromptData",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify(requestData),
                                    },
                                  );

                                  const data = await response.json();
                                  console.log(data);
                                  setReviewPromptDataTest(data.reviewPromptData);
                                  setSentStatus(Array(reviewPromptDataTest.length).fill(false))
                                  setCategorySentStatus(Array(purchasingCustomersCategories.length).fill(true))
                                  categorySentStatus[categoryIndex] = true;
                                } catch (error) {
                                  // Handle any errors
                                  console.error(error);
                                }
                              }}
                            >
                              Prompt Users
                            </Button>
                            <br />
                            {categorySentStatus[categoryIndex] &&
                              reviewPromptData.map((prompt) => (
                                <div>
                                  <p>
                                    {" "}
                                    Followups succesfully generated for userId:{" "}
                                    {prompt.userId}, check the followups tab!
                                  </p>
                                </div>
                              ))}
                          </div>
                        }
                      </Card>
                    ))}
                </>
              )}
              {selectedTab === 2 &&
                reviewPromptDataTest &&
                (reviewPromptDataTest).map((reviewPrompt, reviewIndex) => (
                  <Card>
                      <div>
                        <p><strong>UserID:</strong> {reviewPrompt.userId}</p>
                        <p><strong>Name:</strong> {((reviewPrompt.userId in loaderData.usersMap) ? loaderData.usersMap[reviewPrompt.userId].name : "Error retrieveing name")}</p>
                        <br />
                        <p><strong>Questions:</strong></p>
                        {reviewPrompt.questions.map((question, questionIndex) => (
                          <input
                            key={questionIndex}
                            type="text"
                            value={question}
                            onChange={(e) =>
                              handleQuestionChange(reviewIndex, questionIndex, e.target.value)
                            }
                            style={{
                              width: '100%',
                              padding: '8px',
                              fontSize: '12px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                            }}
                          />
                        ))}
                      </div>
                      <br />
                      <Button>
                        Send
                      </Button>                   
                  </Card>
                ))
              }
              {selectedTab === 3 && (
                <>
                  <input
                    type="text"
                    placeholder="Enter text"
                    onChange={(e) => setAgentQuery(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      const requestData = {
                        productId: selectedProduct,
                        agentQuery: agentQuery,
                        userMode: true,
                        tableToQuery: "Review",
                        caller: "seller",
                      };
                      console.log(selectedProduct);
                      try {
                        const response = await fetch("/agent", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(requestData),
                        });

                        const data = await response.json();

                        // Handle the response from the /agent API
                        setReviewAgentResponse(data?.output);
                        setAgentResult(data?.result);
                        setAgentSqlQuery(data?.sqlQuery);
                      } catch (error) {
                        // Handle any errors
                        console.error(error);
                      }
                    }}
                  >
                    Query Reviews
                  </Button>

                  {reviewAgentResponse && (
                    <>
                      <Card>
                        <p>
                          <strong>Input Query:</strong> {agentQuery}
                        </p>
                      </Card>
                      <Card>
                        <p>
                          <strong>Agent Response:</strong>
                        </p>
                        {reviewAgentResponse && <p>{reviewAgentResponse}</p>}
                        <br /> {/* add new line */}
                        <BlockStack>
                          {agentResult &&
                            JSON.parse(agentResult).map(
                              (obj: any, index: number) => (
                                <Card key={index}>
                                  {obj.similarity_score > 0.45 ? (
                                    <strong>{JSON.stringify(obj)}</strong>
                                  ) : (
                                    JSON.stringify(obj)
                                  )}

                                  {resultChunks[index] && (
                                    <p>{resultChunks[index].chunkBody}</p>
                                  )}
                                </Card>
                              ),
                            )}
                        </BlockStack>
                      </Card>
                      <Card>
                        <p>
                          <strong>SQL Query Used:</strong> {agentSqlQuery}
                        </p>
                      </Card>
                    </>
                  )}

                  {reviewListDetails &&
                    reviewListDetails.map((review, index) => (
                      <Card key={index}>
                        <p>Reviewer Name: {review.reviewerName}</p>
                        <p>Reviewer External ID: {review.reviewerExternalId}</p>
                        <p>Created At: {review.createdAt}</p>
                        <p>Updated At: {review.updatedAt}</p>
                        <p>Verified: {review.verified}</p>
                        <p>Review ID: {review.reviewId}</p>
                        <p>Rating: {review.rating}</p>
                        <p>Review Title: {review.title}</p>
                        <p>Review Body: {review.body}</p>
                      </Card>
                    ))}
                </>
              )}

              {selectedTab === 4 && (
                <>
                  <input
                    type="text"
                    placeholder="Enter text"
                    onChange={(e) => setAgentQuery(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      const requestData = {
                        productId: selectedProduct,
                        agentQuery: agentQuery,
                        userMode: true,
                        tableToQuery: "Queries",
                        caller: "seller",
                      };
                      console.log(selectedProduct);
                      try {
                        const response = await fetch("/agent", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify(requestData),
                        });

                        const data = await response.json();

                        // Handle the response from the /agent API
                        setQueryAgentResponse(data?.output);
                        setAgentResult(data?.result);
                        setAgentSqlQuery(data?.sqlQuery);
                      } catch (error) {
                        // Handle any errors
                        console.error(error);
                      }
                    }}
                  >
                    Query Customer Queries
                  </Button>

                  {queryAgentResponse && (
                    <>
                      <Card>
                        <p>
                          <strong>Input Query:</strong> {agentQuery}
                        </p>
                      </Card>
                      <Card>
                        <p>
                          <strong>Agent Response:</strong>
                        </p>
                        {queryAgentResponse && <p>{queryAgentResponse}</p>}
                        <br /> {/* add new line */}
                        <BlockStack>
                          {agentResult &&
                            JSON.parse(agentResult).map(
                              (obj: any, index: number) => (
                                <Card key={index}>
                                  {obj.similarity_score > 0.45 ? (
                                    <strong>{JSON.stringify(obj)}</strong>
                                  ) : (
                                    JSON.stringify(obj)
                                  )}

                                  {resultQueries && (
                                    <p>{resultQueries[index]}</p>
                                  )}
                                </Card>
                              ),
                            )}
                        </BlockStack>
                      </Card>
                      <Card>
                        <p>
                          <strong>SQL Query Used:</strong> {agentSqlQuery}
                        </p>
                      </Card>
                    </>
                  )}

                  {queriesListDetails &&
                    queriesListDetails.map((query, index) => (
                      <Card key={index}>
                        <p>Query ID: {query.queryId}</p>
                        <p>User ID: {query.userId}</p>
                        <p>Query: {query.query}</p>
                      </Card>
                    ))}
                </>
              )}
              {selectedTab === 5 &&
                allUsersData.map((user, index) => (
                  <div>
                    <Card key={index}>
                      <div style={{ padding: '16px' }}>
                        <p><strong>User ID:</strong> {user.userId}</p>
                        {/* <p><strong>Name:</strong> {((user.userId in loaderData.usersMap) ? loaderData.usersMap[user.userId].name : "Error retrieveing name")}</p> */}
                      </div>
                      <div style={{ padding: '16px', marginTop: '2px' }}>
                        <DataTable
                          columnContentTypes={['text', 'text', 'text']}
                          headings={['Product ID', 'Review IDs', 'Queries']}
                          rows={loaderData.tableDataMap[user.userId].map((row) => ((
                            [row[0],
                            (
                              <ul style={{ margin: 2, padding: 0 }}>
                                {row[2].map((reviewId: string) => (
                                  <p key={reviewId}>{reviewId}</p>
                                ))}
                              </ul>
                            ),
                            (
                              <ul style={{ margin: 2, padding: 0 }}>
                                {row[1].map((query: string) => (
                                  <p key={query}>{query}</p>
                                ))}
                              </ul>
                            )
                            ] // Join reviews array with comma separator
                          )))}
                        />
                      </div>
                    </Card>
                  </div>
                ))
              }
            </Card>
          </Tabs>
        </div>

        {/* {isLoading ? (
        <Card>
          <Spinner size="small" />
          <p>Loading...</p>
        </Card>
      ) : reviewListDetails ? (
        <Card>
          <p>Reviews:</p>
          {reviewListDetails.map((review, index) => (
            <Card key={index}>
              <p>Reviewer Name: {review.reviewerName}</p>
              <p>Reviewer External ID: {review.reviewerExternalId}</p>
              <p>Created At: {review.createdAt}</p>
              <p>Updated At: {review.updatedAt}</p>
              <p>Verified: {review.verified}</p>
              <p>Review ID: {review.reviewId}</p>
              <p>Rating: {review.rating}</p>
              <p>Review Title: {review.title}</p>
              <p>Review Body: {review.body}</p>
            </Card>
          ))}
        </Card>
      ) : relevantChunks ? (
        <BlockStack>
          {relevantChunks && chunksToReviews(relevantChunks)}
        </BlockStack>
      ) : null} */}
      </div>
    </Page>
  );
}

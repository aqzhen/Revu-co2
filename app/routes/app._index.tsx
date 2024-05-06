import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  Page,
  RangeSlider,
  Tabs,
} from "@shopify/polaris";
import { Stratify } from "~/frontend/components/Stratify";
import { useCallback, useEffect, useState } from "react";
import { getProducts } from "../backend/api_calls";
import { parseReviewsData } from "../metafield_parsers/judge";
import { authenticate } from "../shopify.server";
// import { addReviewsToDatabase } from "./backend/prisma/helpers";
import { addExistingUsers } from "~/backend/vectordb/add";
import { createAllTables } from "~/backend/vectordb/create";
import { getAllUsers, getCxQueries } from "~/backend/vectordb/get";
import { initializeDBconnections } from "~/backend/vectordb/misc";
import {
  updateExistingUsers,
  updatePurchasedStatus,
} from "~/backend/vectordb/update";
import { Chunk } from "../backend/langchain/chunking";
import { Category, Query, Review, ReviewPrompt, User } from "../globals";
import { Workflows } from "~/frontend/components/Workflows";
import EmailSender from "~/frontend/components/emailSender";

// trigger action to get reviews
const initializeReviews = async (
  domain: string,
  pushReviews: boolean = false
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

  await initializeDBconnections();
  await createAllTables(false);
  await updatePurchasedStatus();

  // TODO: TEST THESE
  await addExistingUsers();
  await updateExistingUsers();

  const reviewsHashmap = await initializeReviews(domain, false);

  const { allUsersData, tableDataMap, usersMap } = await getAllUsers();

  console.log("Loading products");
  const productData = await (await getProducts()).json();
  // await addAllProducts();
  const cxQueries = await getCxQueries();

  return {
    reviewsHashmap,
    productData,
    allUsersData,
    tableDataMap,
    usersMap,
    cxQueries,
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
  var [allUsersData, setAllUsersData] = useState<User[]>(
    loaderData.allUsersData
  );

  // Reviews
  var [reviewListDetails, setReviewListDetails] = useState<Review[]>([]); // used to store the entire list of reviews for a product
  // var [chunkBodies, setChunkBodies] = useState<string[]>([]); // used to store the list of reviews returned on a query

  // Queries
  var [queriesListDetails, setQueriesListDetails] = useState<Query[]>([]); // used to store the entire list of queries for a product

  // CX Queries
  var [cxQueriesListDetails, setcxQueriesListDetails] = useState<Query[]>([]); // used to store the entire list of queries for a product
  const [cxQueriesCheckbox, setcxQueriesCheckbox] = useState<
    Map<number, boolean>
  >(new Map());
  var [automatedAnswer, setAutomatedAnswer] = useState<string>(""); // used to store the entire list of queries for a product

  // Followups
  var [reviewPromptData, setReviewPromptData] = useState<any[]>([]);
  var [reviewPromptDataTest, setReviewPromptDataTest] = useState<
    ReviewPrompt[]
  >([]);
  var [sentStatus, setSentStatus] = useState<boolean[]>([]);
  var [categorySentStatus, setCategorySentStatus] = useState<boolean[]>([]);
  // var [editedQuestions, setEditedQuestions] = useState<string[][]>([]);

  // Sellside Insights - Window Shoppers
  var [windowCategories, setWindowCategories] = useState<Category[]>([]);
  var [windowInsights, setWindowInsights] = useState<string>("");
  var [windowSuggestions, setWindowSuggestions] = useState<string[]>([]);
  var [windowKeywords, setWindowKeywords] = useState<string>("");

  // Sellside Insights - Purchasing Customers
  var [purchasingCustomersInsights, setPurchasingCustomersInsights] =
    useState<string>("");
  var [purchasingCustomersCategories, setPurchasingCustomersCategories] =
    useState<Category[]>([]);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    []
  );

  // FAQ Documents
  var [faqString, setFaqString] = useState<string>("");
  var [faqStrings, setFaqStrings] = useState<string[]>([]);

  const tabs = [
    {
      id: "pulse-1",
      content: "Pulse",
      accessibilityLabel: "Pulse",
      panelID: "pulse-content-1",
    },
    {
      id: "stratify-1",
      content: "Stratify",
      panelID: "stratify-content-1",
    },
    {
      id: "workflows-1",
      content: "Workflows",
      panelID: "workflows-content-1",
    },
    {
      id: "customer-support-1",
      content: "Customer Support",
      panelID: "customer-support-content-1",
    },
    {
      id: "users-1",
      content: "Users",
      panelId: "users-content-1",
    },
    {
      id: "followups-1",
      content: "Followups",
      panelID: "followups-content-1",
    },
  ];

  // calling api to get reviews for returned reviews/chunks after a query
  const reviewIds: number[] = [];
  const chunkNumbers: number[] = [];
  const queryIds: number[] = [];

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

  const handleRangeSliderChange = useCallback(
    (value: number) => setsliderRangeValue(value),
    []
  );
  const handleQuestionChange = (
    reviewIndex: number,
    questionIndex: number,
    newValue: string
  ) => {
    const updatedQuestions = [...reviewPromptDataTest];
    updatedQuestions[reviewIndex].questions[questionIndex] = newValue;
    setReviewPromptDataTest(updatedQuestions);
  };

  const handleSend = (reviewIndex: number) => {
    sentStatus[reviewIndex] = !sentStatus[reviewIndex];
  };

  useEffect(() => {
    if (loaderData?.productData?.products?.length > 0) {
      setProducts(
        loaderData.productData.products.map((edge: any) => ({
          id: edge?.node?.id,
          title: edge?.node?.title,
          imageUrl: edge?.node?.images?.edges?.[0]?.node?.url,
        }))
      );
    }
    if (loaderData?.cxQueries) {
      setcxQueriesListDetails(loaderData?.cxQueries.queries);
    }
  }, []);

  // set selected product
  const handleProductSelection = async (productId: string) => {
    var trimmed_id = productId.replace("gid://shopify/Product/", "");
    setSelectedProduct(Number(trimmed_id));
    initializeQueries(Number(trimmed_id));
    // console.log(loaderData.reviewsHashmap);
    const reviews = loaderData?.reviewsHashmap ?? {};
    setReviewListDetails(reviews[Number(trimmed_id)]);
    // console.log(reviews[Number(trimmed_id)]);
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
                          }
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
                  <Stratify></Stratify>
                </>
              )}

              {selectedTab === 2 && (
                <>
                  <Workflows></Workflows>
                  <EmailSender></EmailSender>
                </>
              )}

              {selectedTab === 3 && (
                <>
                  <input
                    type="text"
                    placeholder="Enter Automated Answer"
                    onChange={(e) => setAutomatedAnswer(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      try {
                        let supportQueryIds = [];
                        for (let key of cxQueriesCheckbox.keys()) {
                          if (cxQueriesCheckbox.get(key)) {
                            supportQueryIds.push(key);
                          }
                        }
                        const requestData = {
                          queryIds: supportQueryIds,
                          answer: automatedAnswer,
                        };
                        console.log(
                          "Automating answer for queries: ",
                          requestData
                        );
                        const response = await fetch(
                          "/supportQueries/automateAnswer",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(requestData),
                          }
                        );

                        const data = await response.json();
                      } catch (error) {
                        // Handle any errors
                        console.error(error);
                      }
                    }}
                  >
                    Automate Answer
                  </Button>

                  {faqStrings.map((faq, index) => (
                    <Card key={index}>
                      <p>{faq}</p>
                      <Button
                        onClick={() => {
                          const updatedFaqs = [...faqStrings];
                          updatedFaqs.splice(index, 1);
                          setFaqStrings(updatedFaqs);
                        }}
                      >
                        Delete
                      </Button>
                    </Card>
                  ))}
                  <input
                    type="text"
                    placeholder="Enter FAQ Document"
                    onChange={(e) => setFaqString(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      setFaqStrings([...faqStrings, faqString]); // Clear the input after saving
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    onClick={async () => {
                      const requestData = {
                        documents: faqStrings,
                      };
                      // console.log(selectedProduct);
                      try {
                        const response = await fetch("/cx/addCorpusChunks", {
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
                    }}
                  >
                    Add to FAQ Bot
                  </Button>

                  {cxQueriesListDetails &&
                    cxQueriesListDetails.map((query, index) => (
                      <Card key={index}>
                        <p>Query ID: {query.queryId}</p>
                        <p>User ID: {query.userId}</p>
                        <p>Query: {query.query}</p>
                        <p>Answer: {query.answer}</p>
                        <Checkbox
                          checked={cxQueriesCheckbox.get(query.queryId)}
                          onChange={() => {
                            const updatedMap = new Map(cxQueriesCheckbox); // hella inefficient
                            updatedMap.set(
                              query.queryId,
                              !cxQueriesCheckbox.get(query.queryId)
                            );
                            setcxQueriesCheckbox(updatedMap);
                          }}
                          label={undefined}
                        />
                      </Card>
                    ))}
                </>
              )}

              {selectedTab === 4 &&
                allUsersData.map((user, index) => (
                  <div>
                    <Card key={index}>
                      <div style={{ padding: "16px" }}>
                        <p>
                          <strong>User ID:</strong> {user.userId}
                        </p>
                        {/* <p><strong>Name:</strong> {((user.userId in loaderData.usersMap) ? loaderData.usersMap[user.userId].name : "Error retrieveing name")}</p> */}
                      </div>
                      <div style={{ padding: "16px", marginTop: "2px" }}>
                        <DataTable
                          columnContentTypes={["text", "text", "text"]}
                          headings={["Product ID", "Review IDs", "Queries"]}
                          rows={loaderData.tableDataMap[user.userId].map(
                            (row) => [
                              row[0],
                              <ul style={{ margin: 2, padding: 0 }}>
                                {row[2].map((reviewId: string) => (
                                  <p key={reviewId}>{reviewId}</p>
                                ))}
                              </ul>,
                              <ul style={{ margin: 2, padding: 0 }}>
                                {row[1].map((query: string) => (
                                  <p key={query}>{query}</p>
                                ))}
                              </ul>,
                            ] // Join reviews array with comma separator
                          )}
                        />
                      </div>
                    </Card>
                  </div>
                ))}

              {selectedTab === 5 &&
                reviewPromptDataTest &&
                reviewPromptDataTest.map((reviewPrompt, reviewIndex) => (
                  <Card>
                    <div>
                      <p>
                        <strong>UserID:</strong> {reviewPrompt.userId}
                      </p>
                      <p>
                        <strong>Name:</strong>{" "}
                        {reviewPrompt.userId in loaderData.usersMap
                          ? loaderData.usersMap[reviewPrompt.userId].name
                          : "Error retrieveing name"}
                      </p>
                      <br />
                      <p>
                        <strong>Questions:</strong>
                      </p>
                      {reviewPrompt.questions.map((question, questionIndex) => (
                        <input
                          key={questionIndex}
                          type="text"
                          value={question}
                          onChange={(e) =>
                            handleQuestionChange(
                              reviewIndex,
                              questionIndex,
                              e.target.value
                            )
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                          }}
                        />
                      ))}
                    </div>
                    <br />
                    <Button>Send</Button>
                  </Card>
                ))}
            </Card>
          </Tabs>
        </div>
      </div>
    </Page>
  );
}

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
import { CX } from "~/frontend/components/CX";
import { Users } from "~/frontend/components/Users";
import Pulse from "~/frontend/components/Pulse";

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

  // await createDB();
  await initializeDBconnections();
  await createAllTables(false);
  // await updatePurchasedStatus();

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

  // CXQueries
  var [cxQueriesListDetails, setcxQueriesListDetails] = useState<Query[]>([]); // used to store the entire list of queries for a product

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    []
  );

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
  ];

  const handleRangeSliderChange = useCallback(
    (value: number) => setsliderRangeValue(value),
    []
  );

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
                  <Pulse
                    selectedProduct={selectedProduct as number}
                    sliderRangeValue={sliderRangeValue}
                  ></Pulse>
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
                </>
              )}

              {selectedTab === 3 && (
                <>
                  <p>Selected Product ID: {selectedProduct}</p>
                  {selectedProduct ? null : (
                    <p style={{ color: "red" }}>Please select a product</p>
                  )}
                  <Button onClick={() => handleProductSelection("-1")}>
                    View All Products
                  </Button>
                  <CX
                    cxQueriesList={cxQueriesListDetails}
                    productId={selectedProduct as number}
                  />
                </>
              )}

              {selectedTab === 4 && (
                <Users
                  allUsersData={allUsersData}
                  loaderData={loaderData}
                ></Users>
              )}
            </Card>
          </Tabs>
        </div>
      </div>
    </Page>
  );
}

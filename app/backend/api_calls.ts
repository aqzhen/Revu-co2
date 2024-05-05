import { json } from "@remix-run/node";

export async function getProducts() {
  const response = await admin.graphql(`
      #graphq
      query {
        products(first: 20) {
          edges {
            node {
              id
              description
              title
              images (first: 1) {
                edges {
                  node {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `);
  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch products");
  }
  const responseJson = await response.json();

  return json({ products: responseJson.data?.products?.edges });
}

export async function fetchJudgeReviews() {
  const judgeApiKey = process.env.JUDGE_API_KEY;
  const shopDomain = process.env.SHOPIFY_DOMAIN;

  const response = await fetch(
    `https://judge.me/api/v1/reviews?api_token=${judgeApiKey}&shop_domain=${shopDomain}&per_page=100`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch reviews");
  }

  const responseJson = await response.json();

  return json({
    reviews: responseJson.reviews,
  });
}

export async function fetchJudgeReview(reviewId: string) {
  const judgeApiKey = process.env.JUDGE_API_KEY;
  const shopDomain = process.env.SHOPIFY_DOMAIN;

  const response = await fetch(
    `https://judge.me/api/v1/reviews/${reviewId}?api_token=${judgeApiKey}&shop_domain=${shopDomain}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch reviews");
  }

  const responseJson = await response.json();

  return json({
    review: responseJson.review,
  });
}

export async function getCustomerProductPurchases(customerId: number) {
  try {
    const response = await admin.graphql(`
      query {
        customer(id: "gid://shopify/Customer/${customerId}") {
          orders (first:10) {
            edges {
              node {
                lineItems (first:10) {
                  edges {
                    node {
                      product {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);
    // if (!response.ok) {
    //   // Handle error if response is not ok
    //   throw new Error("Failed to fetch products");
    // }
    const responseJson = await response.json();

    const productIds: number[] =
      responseJson.data?.customer?.orders?.edges?.flatMap((edge: any) =>
        edge.node.lineItems.edges.map((item: any) =>
          Number(item.node.product.id.replace("gid://shopify/Product/", ""))
        )
      );
    return json({ productIds: productIds });
  } catch (error) {
    // Handle error
    throw new Error("Failed to fetch customer product purchases");
  }
}

export async function getCustomerEmail(customerId: number) {
  const response = await admin.graphql(`
    query {
      customer(id: "gid://shopify/Customer/${customerId}") {
        email
      }
    }
  `);
  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch product description");
  }
  const responseJson = await response.json();

  return { email: responseJson.data?.customer?.email };
}

export async function getExistingCustomers() {
  // TODO: FIGURE OUT HOW TO DO MORE THAN 250
  const response = await admin.graphql(`
    query {
      customers(first: 250) { 
        edges {
          node {
            id
            email
          }
        }
      }
    }
  `);
  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch customers");
  }
  const responseJson = await response.json();

  return { customers: responseJson.data?.customers?.edges };
}

export async function getCustomerIdFromEmail(email: string) {
  const response = await admin.graphql(`
    query {
      customers(first: 1, query: "${email}") {
        edges {
          node {
            id
          }
        }
      }
    }
  `);

  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch customers");
  }
  const responseJson = await response.json();

  return { id: responseJson.data?.customers?.edges.node.id };
}

export async function getProductDescription(productId: number) {
  const response = await admin.graphql(`
    query {
      product(id: "gid://shopify/Product/${productId}") {
        description
      }
    }
  `);
  if (!response.ok) {
    // Handle error if response is not ok
    throw new Error("Failed to fetch product description");
  }
  const responseJson = await response.json();

  return { description: responseJson.data?.product?.description };
}

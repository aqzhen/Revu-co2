import {
  addQueryToSingleStore,
  addSellerQueryToSingleStore,
} from "~/backend/vectordb/add";

export async function callCatalogSearchAgent(
  customerId: number = -1,
  productId: number = -1,
  email: string = "",
  query: string,
  isSeller: boolean = false
) {
  if (customerId === -1 && email === "") {
    console.error("ERROR: No customer ID or email provided.");
    return null;
  }
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
        email,
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
    console.log("Calling catalog search agent...");
    let allReviews;
    let productData;

    // Catalog Level Search
    if (productId == -1) {
      allReviews = await langchain_db.run(
        `SELECT R.productId, R.reviewId, E.chunkNumber, E.body, DOT_PRODUCT(E.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
          FROM Review R CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query 
          JOIN Embeddings E ON R.reviewId = E.reviewId
          ORDER BY similarity_score DESC
          LIMIT 10;
          `
      );
      productData = await langchain_db.run(
        `SELECT P.productId, PE.body, PE.chunkNumber, DOT_PRODUCT(PE.chunkEmbedding, Query.semanticEmbedding) AS similarity_score 
          FROM ProductEmbeddings PE
          JOIN Products P ON PE.productId = P.productId CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query
          ORDER BY similarity_score DESC
          LIMIT 10;`
      );
    }
    // Product Level Search 
    else {
      allReviews = await langchain_db.run(
        `SELECT R.productId, R.reviewId, E.chunkNumber, E.body, DOT_PRODUCT(E.chunkEmbedding, Query.semanticEmbedding) AS similarity_score
          FROM Review R CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query 
          JOIN Embeddings E ON R.reviewId = E.reviewId
          WHERE R.productId = ${productId}
          ORDER BY similarity_score DESC
          LIMIT 10;
          `
      );
      productData = await langchain_db.run(
        `SELECT P.productId, PE.body, PE.chunkNumber, DOT_PRODUCT(PE.chunkEmbedding, Query.semanticEmbedding) AS similarity_score 
          FROM ProductEmbeddings PE 
          JOIN Products P ON PE.productId = P.productId CROSS JOIN (SELECT semanticEmbedding FROM Queries WHERE queryId = ${queryId}) AS Query
          WHERE P.productId = ${productId}
          ORDER BY similarity_score DESC
          LIMIT 10;`
      );
    }

    let filteredReviews = JSON.parse(allReviews).filter(
      (r: any) => r.similarity_score > 0.45
    );

    // console.log(JSON.parse(productData));
    let filteredPdData = JSON.parse(productData).filter(
      (pd: any) => pd.similarity_score > 0.3
    );

    console.log("PD Search Agent Results:" + filteredPdData.length + "\n");
    console.log(
      "Reviews Search Agent Results:" + filteredReviews.length + "\n"
    );

    let productInfoMap = new Map<number, any>();    
    filteredPdData.forEach((pd: any) => {
      let {productId, body, chunkNumber, similarity_score} = pd;
      if (!productInfoMap.has(productId)) {
        productInfoMap.set(productId, {
          productDescriptionResults: 
          [{
            productId: productId,
            body: body,
            similarity_score: similarity_score,
          }],
          reviewsResults: []
        });
      } else {
        productInfoMap.get(productId).productDescriptionResults.push({
          productId: productId,
          body: body,
          similarity_score: similarity_score,
        });
      }
    });
    
    filteredReviews.forEach((r: any) => {
      let {productId, reviewId, body, chunkNumber, similarity_score} = r;
      if (!productInfoMap.has(productId)) {
        productInfoMap.set(productId, {
          productDescriptionResults: [],
          reviewsResults: 
          [{
            productId: productId,
            reviewId: reviewId,
            body: body,
            chunkNumber: chunkNumber,
            similarity_score: similarity_score,
          }]
        });
      } else {
        productInfoMap.get(productId).reviewsResults.push({
          productId: productId,
          reviewId: reviewId,
          body: body,
          chunkNumber: chunkNumber,
          similarity_score: similarity_score,
        });
      }
    });

    // console.log("Product Info Map: " + [...productInfoMap] + "\n");
    // for (let [productId, productInfo] of productInfoMap) {
    //   console.log("Product ID: " + productId + "\n");
    //   // console.log("Product Description Results: " + productInfo.productDescriptionResults + "\n");
    //   for (let pd of productInfo.productDescriptionResults) {
    //     console.log("Product ID: " + pd.productId + "\n");
    //     console.log("Body: " + pd.body + "\n");
    //     console.log("Similarity Score: " + pd.similarity_score + "\n");
    //   }
    //   // console.log("Reviews Results: " + productInfo.reviewsResults + "\n");
    //   for (let r of productInfo.reviewsResults) {
    //     console.log("Product ID: " + r.productId + "\n");
    //     console.log("Review ID: " + r.reviewId + "\n");
    //     console.log("Body: " + r.body + "\n");
    //     console.log("Chunk Number: " + r.chunkNumber + "\n");
    //     console.log("Similarity Score: " + r.similarity_score + "\n");
    //   }
    // }

    const productButtonsAndDetailsHTML = generateProductButtonsAndDetails(productInfoMap);
    console.log(productButtonsAndDetailsHTML);

// // Return the concatenated HTML string
    return {htmlString: productButtonsAndDetailsHTML};

    return {
      productDescriptionOutput: filteredPdData,
      reviewsOutput: filteredReviews,
    };
  } catch (err) {
    console.error("ERROR", err);
    return null;
  }
}

function generateProductButtonsAndDetails(productInfoMap: Map<number, any>) {
  let htmlString = ""; // Initialize an empty string to store the HTML
  
  for (let [productId, productInfo] of productInfoMap.entries()) {
    // Generate button for the product ID
    // htmlString += `<button id=product-button-${productId} `;
    // // htmlString += `onmouseover=showProductDetails(${productId}) `;
    // // htmlString += `onmouseleave=hideProductDetails(${productId})>`;
    // htmlString += `onclick=document.getElementById('product-${productId}').style.display='block';>`;
    // htmlString += `Product ID: ${productId}</button>`;
    
    // Generate and append product details HTML
    htmlString += generateProductDetails(productId, productInfo);
  }
  // htmlString = htmlString.replace(/(\r\n|\n|\r)/gm, "");
  
  return htmlString; // Return the concatenated HTML string
}

function generateProductDetails(productId: number, productInfo: { productDescriptionResults: any[]; reviewsResults: any[]; }) {
  let detailsHTML = `<div id=product-${productId} style=${`display: none;`}> `;
  detailsHTML += `<h3>Product ID: ${productId}</h3>`;
  detailsHTML += `<h4>Product Description:</h4>`;
  
  if (productInfo.productDescriptionResults.length === 0) {
    detailsHTML += `<p><em>No relevant product description results found.</em></p>`;
  }
  // Add product description results
  productInfo.productDescriptionResults.forEach((description: { body: any; similarity_score: any; }) => {
    detailsHTML += `<p><em>${description.body}</em></p>`;
    // detailsHTML += `<p>Similarity Score: ${description.similarity_score}</p>`;
  });
  
  detailsHTML += `<h4>Reviews:</h4>`;
  
  if (productInfo.reviewsResults.length === 0) {
    detailsHTML += `<p><em>No relevant reviews found.</em></p>`;
  }
  // Add reviews results
  productInfo.reviewsResults.forEach((review: { reviewId: any; body: any; chunkNumber: any; similarity_score: any; }) => {
    detailsHTML += `<p>Review ID: ${review.reviewId}</p>`;
    detailsHTML += `<p><em>${review.body}</em></p>`;
    // detailsHTML += `<p>Chunk Number: ${review.chunkNumber}</p>`;
    // detailsHTML += `<p>Similarity Score: ${review.similarity_score}</p>`;
  });
  
  detailsHTML += `</div>`;
  
  return detailsHTML;
}


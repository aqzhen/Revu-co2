import React, { useState } from "react";

import { Category } from "~/globals";
import { Button, Card } from "@shopify/polaris";

export function Pulse({
  selectedProduct,
  sliderRangeValue,
}: {
  selectedProduct: number;
  sliderRangeValue: number;
}): JSX.Element {
  var [windowCategories, setWindowCategories] = useState<Category[]>([]);
  var [windowInsights, setWindowInsights] = useState<string>("");
  var [windowSuggestions, setWindowSuggestions] = useState<string[]>([]);
  var [windowKeywords, setWindowKeywords] = useState<string>("");

  return (
    <>
      <Button
        onClick={async () => {
          try {
            const requestData = {
              productId: selectedProduct,
              selector: "windowShoppers",
              k: sliderRangeValue,
            };

            const response = await fetch("/agent/sellSideInsights", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestData),
            });
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
                  <strong style={{ color: "green", fontWeight: "bold" }}>
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
                  <strong>Suggestions:</strong> {category.suggestions}
                </p>
                <br />
                <details>
                  <summary> See Relevant Queries </summary>
                  {category.queries.map((query) => (
                    <div key={query.queryId}>
                      <p>
                        {" "}
                        <strong>Query: </strong> {query.query} (Query ID:{" "}
                        {query.queryId}, User ID: {query.userId})
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
  );
}

export default Pulse;

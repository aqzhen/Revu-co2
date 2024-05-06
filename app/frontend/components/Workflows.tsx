import React, { useEffect, useState } from "react";
import {
  IndexTable,
  Card,
  Text,
  useBreakpoints,
  useIndexResourceState,
} from "@shopify/polaris";
import { Segment } from "~/globals";

export function Workflows() {
  const [segments, setSegments] = useState([] as Segment[]);
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(segments);

  useEffect(() => {
    async function fetchData() {
      const response = await fetch("/stratify/getSegments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log(data);
      const segments: Segment[] = data;
      setSegments(segments);
    }

    fetchData();
  }, []);

  const resourceName = {
    singular: "segment",
    plural: "segments",
  };

  const rowMarkup = segments.map(
    (
      {
        segmentId,
        purchaseStatus,
        productId,
        semanticSegmentReview,
        semanticSegmentQuery,
        semanticSegmentCxQuery,
      },
      index
    ) => (
      <IndexTable.Row
        id={segmentId?.toString() as string}
        key={segmentId}
        selected={selectedResources.includes(segmentId?.toString() as string)}
        position={segmentId as number}
      >
        <IndexTable.Cell>
          <Text fontWeight="bold" as="span">
            {segmentId}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{purchaseStatus}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end" numeric>
            {productId}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end" numeric>
            {semanticSegmentReview}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end" numeric>
            {semanticSegmentQuery}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end" numeric>
            {semanticSegmentCxQuery}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Card>
      <IndexTable
        condensed={useBreakpoints().smDown}
        resourceName={resourceName}
        itemCount={segments.length}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Segment ID" },
          { title: "Purchase Status" },
          { title: "Product ID" },
          {
            id: "Review",
            title: (
              <Text as="span" alignment="end">
                Review Segment
              </Text>
            ),
          },
          {
            id: "Query",
            hidden: false,
            title: (
              <Text as="span" alignment="end">
                Query Segment
              </Text>
            ),
          },
          {
            id: "CX-Query",
            hidden: false,
            title: (
              <Text as="span" alignment="end">
                CX Query Segment
              </Text>
            ),
          },
        ]}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}

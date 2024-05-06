import React, { useState, useCallback } from "react";
import {
  ChoiceList,
  TextField,
  RangeSlider,
  Card,
  ResourceList,
  Filters,
  Avatar,
  Text,
} from "@shopify/polaris";
import { Segment, User } from "~/globals";

export enum PurchaseStatus {
  WINDOW, // queried, didn't add to cart
  ABANDONEDCART, // added to cart, didn't purchase
  PURCHASED,
}

export function Stratify() {
  const [purchaseStatus, setPurchaseStatus] = useState<string[] | undefined>(
    undefined
  );
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [segmentReviews, setSegmentReviews] = useState<string | undefined>(
    undefined
  );
  const [segmentQueries, setSegmentQueries] = useState<string | undefined>(
    undefined
  );
  const [segmentCXQueries, setSegmentCXQueries] = useState<string | undefined>(
    undefined
  );
  const [queryValue, setQueryValue] = useState<string | undefined>(undefined);
  const [segmentCustomers, setSegmentCustomers] = useState<User[] | undefined>(
    []
  );
  const [segment, setSegment] = useState<Segment | undefined>(undefined);

  const handlePurchaseStatusChange = useCallback((value: string[]) => {
    setPurchaseStatus(value);
  }, []);
  const handleProductIdChange = useCallback(
    (value: string) => setProductId(value),
    []
  );
  const handleSegmentReviewsChange = useCallback(
    (value: string) => setSegmentReviews(value),
    []
  );
  const handleSegmentQueriesChange = useCallback(
    (value: string) => setSegmentQueries(value),
    []
  );
  const handleSegmentCXQueriesChange = useCallback(
    (value: string) => setSegmentCXQueries(value),
    []
  );
  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    []
  );
  const handlePurchaseStatusRemove = useCallback(
    () => setPurchaseStatus(undefined),
    []
  );
  const handleProductIdRemove = useCallback(() => setProductId(undefined), []);
  const handleSegmentReviewsRemove = useCallback(
    () => setSegmentReviews(undefined),
    []
  );
  const handleSegmentQueriesRemove = useCallback(
    () => setSegmentQueries(undefined),
    []
  );
  const handleSegmentCXQueriesRemove = useCallback(
    () => setSegmentCXQueries(undefined),
    []
  );
  const handleQueryValueRemove = useCallback(
    () => setQueryValue(undefined),
    []
  );
  const handleFiltersClearAll = useCallback(() => {
    handlePurchaseStatusRemove();
    handleProductIdRemove();
    handleSegmentReviewsRemove();
    handleSegmentQueriesRemove();
    handleSegmentCXQueriesRemove();
    handleQueryValueRemove();
  }, [
    handlePurchaseStatusRemove,
    handleProductIdRemove,
    handleSegmentReviewsRemove,
    handleSegmentQueriesRemove,
    handleSegmentCXQueriesRemove,
    handleQueryValueRemove,
  ]);

  async function handleSearch() {
    setSegmentCustomers([]);
    console.log("status: " + purchaseStatus![0]);

    const requestData = {
      purchaseStatus:
        purchaseStatus![0] == "Purchased"
          ? 2
          : purchaseStatus![0] == "Abandoned Cart"
            ? 1
            : 0,
      productId: productId,
      semanticSegmentReview: segmentReviews,
      semanticSegmentQuery: segmentQueries,
      semanticSegmentCxQuery: segmentCXQueries,
      overReviews: segmentReviews != undefined,
      overQueries: segmentQueries != undefined,
      overCxQueries: segmentCXQueries != undefined,
    };
    console.log("Automating answer for queries: ", requestData);
    const response = await fetch("/stratify/createSegment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const data: Segment = await response.json();
    console.log("Segment data: ", data);
    setSegment(data);
    const userIds = data.userIds;

    console.log("UserIds: ", userIds);

    for (const userId of userIds) {
      const requestData = {
        userId: userId,
      };

      console.log("Getting profile details for userId: ", userId);

      const response = await fetch(`/users/getProfileDetails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data && data.user) {
        const customer: User = data.user;

        setSegmentCustomers((prevSegmentCustomers) => [
          ...(prevSegmentCustomers || []),
          customer,
        ]);
      }
    }
  }

  async function handleSaveSegment() {
    console.log("Saving segment: ", segment);
    const requestData = {
      segment: segment,
    };

    const response = await fetch(`/stratify/saveSegment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    let status = (await response.json()).status;

    if (status == 1) alert("Segment saved successfully!");
  }

  const filters = [
    {
      key: "purchaseStatus",
      label: "Purchase status",
      filter: (
        <ChoiceList
          title="Purchase status"
          titleHidden
          choices={[
            { label: "Window Shoppers", value: "Window Shoppers" },
            { label: "Abandoned Cart", value: "Abandoned Cart" },
            { label: "Purchased", value: "Purchased" },
          ]}
          selected={purchaseStatus || []}
          onChange={handlePurchaseStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: "productId",
      label: "Product ID",
      filter: (
        <TextField
          label="Product ID"
          value={productId}
          onChange={handleProductIdChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    {
      key: "segmentReviews",
      label: "Segment Reviews",
      filter: (
        <TextField
          label="Segment Reviews"
          value={segmentReviews}
          onChange={handleSegmentReviewsChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    {
      key: "segmentQueries",
      label: "Segment Queries",
      filter: (
        <TextField
          label="Segment Queries"
          value={segmentQueries}
          onChange={handleSegmentQueriesChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    {
      key: "segmentCXQueries",
      label: "Segment CX Queries",
      filter: (
        <TextField
          label="Segment CX Queries"
          value={segmentCXQueries}
          onChange={handleSegmentCXQueriesChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (!isEmpty(purchaseStatus)) {
    const key = "purchaseStatus";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, purchaseStatus),
      onRemove: handlePurchaseStatusRemove,
    });
  }
  if (!isEmpty(productId)) {
    const key = "productId";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, productId),
      onRemove: handleProductIdRemove,
    });
  }
  if (!isEmpty(segmentReviews)) {
    const key = "segmentReviews";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, segmentReviews),
      onRemove: handleSegmentReviewsRemove,
    });
  }
  if (!isEmpty(segmentQueries)) {
    const key = "segmentQueries";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, segmentQueries),
      onRemove: handleSegmentQueriesRemove,
    });
  }
  if (!isEmpty(segmentCXQueries)) {
    const key = "segmentCXQueries";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, segmentCXQueries),
      onRemove: handleSegmentCXQueriesRemove,
    });
  }

  return (
    <div>
      <Card>
        <button onClick={handleSearch}>Find Segment</button>
        <button onClick={handleSaveSegment}>Save Segment</button>
        <ResourceList
          resourceName={{ singular: "customer", plural: "customers" }}
          filterControl={
            <Filters
              queryValue={queryValue}
              filters={filters}
              appliedFilters={appliedFilters}
              onQueryChange={handleFiltersQueryChange}
              onQueryClear={handleQueryValueRemove}
              onClearAll={handleFiltersClearAll}
              disableQueryField
            />
          }
          flushFilters
          items={segmentCustomers ?? []}
          renderItem={(item) => {
            const { userId, name, email } = item;
            const media = <Avatar customer size="md" name={name} />;

            return (
              <ResourceList.Item
                id={userId.toString()} // Convert userId to a string
                url="#"
                media={media}
                accessibilityLabel={`View details for ${name}`}
              >
                <Text as="h3" variant="bodyMd" fontWeight="bold">
                  {name}
                </Text>
                <div>{userId}</div>
                <div>{email}</div>
              </ResourceList.Item>
            );
          }}
        />
      </Card>
    </div>
  );

  function disambiguateLabel(key: string, value: any): string {
    switch (key) {
      case "purchaseStatus":
        return `Purchase status is ${value.join(", ")}`;
      default:
        return ""; // Add a default return statement
    }
  }
  function isEmpty(
    value: string | string[] | [number, number] | undefined
  ): boolean {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  }
}

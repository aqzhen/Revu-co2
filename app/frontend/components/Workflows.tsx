import { useEffect, useState } from "react";
import {
  IndexTable,
  Card,
  Text,
  useBreakpoints,
  useIndexResourceState,
  ResourceList,
  Avatar,
} from "@shopify/polaris";
import { Segment } from "~/globals";
import { User } from "~/globals";
import { CSVLink } from "react-csv";

export function Workflows() {
  const [segments, setSegments] = useState([] as Segment[]);
  const [users, setUsers] = useState<{ [segmentId: string]: User[] }>({}); // Initialize with an empty object instead of an empty array
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    removeSelectedResources,
  } = useIndexResourceState(segments);

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

      // Get users for each segment
      const allUsers: { [segmentId: string]: User[] } = {};
      for (const segment of segments) {
        let segmentUsers: User[] = [];
        for (const userId of segment.userIds) {
          if (userId === -1) {
            // Skip the only email user
            continue;
          }
          const requestData = {
            userId: userId,
          };
          const response = await fetch("/users/getProfileDetails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          });
          const data = await response.json();
          const user: User = data;
          segmentUsers.push(user);
        }
        allUsers[segment.segmentId!.toString()] = segmentUsers;
      }
      setUsers(allUsers);
    }

    fetchData();
  }, []);

  useEffect(() => {
    setSelectedUsers([]); // Clear the selected users when the selected segments change
    const uniqueUsers: User[] = [];
    for (const resource of selectedResources) {
      const segmentUsers = users[resource] || [];
      for (const user of segmentUsers) {
        if (
          !uniqueUsers.some(
            (u) => u.userId === user.userId || u.email === user.email
          )
        ) {
          uniqueUsers.push(user);
        }
      }
    }
    setSelectedUsers(uniqueUsers);
  }, [selectedResources]);

  const handleDeleteSelectedSegments = async () => {
    const requestData = {
      segmentIds: selectedResources,
    };
    await fetch("/stratify/deleteSegments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });
    const updatedSegments = segments.filter(
      (segment) => !selectedResources.includes(segment.segmentId!.toString())
    );
    setSegments(updatedSegments);

    removeSelectedResources(selectedResources);
  };

  const resourceName = {
    singular: "segment",
    plural: "segments",
  };

  const rowMarkup = segments.map(
    (
      {
        segmentName,
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
            {segmentName}
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
    <>
      <Card>
        {selectedResources.length > 0 && (
          <button onClick={handleDeleteSelectedSegments}>
            Delete Selected
          </button>
        )}
        <IndexTable
          condensed={useBreakpoints().smDown}
          resourceName={resourceName}
          itemCount={segments.length}
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: "Segment Name" },
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

      {selectedUsers && selectedUsers.length > 0 && (
        <>
          <CSVLink data={selectedUsers}>Export as CSV</CSVLink>
          <ResourceList
            resourceName={{ singular: "customer", plural: "customers" }}
            items={
              selectedUsers.map((user) => ({
                userId: user.userId,
                name: user.name,
                email: user.email,
              })) ?? []
            }
            renderItem={(item: { userId: any; name: any; email: any }) => {
              const { userId, name, email } = item;
              const media = <Avatar customer size="md" name={name} />;

              return (
                <ResourceList.Item
                  id={userId ? userId.toString() : email} // Convert userId to a string
                  url="#"
                  media={media}
                  accessibilityLabel={`View details for ${name}`}
                >
                  <Text as="h3" variant="bodyMd" fontWeight="bold">
                    {name}
                  </Text>
                  {userId && <div>{userId}</div>}
                  {email && <div>{email}</div>}
                </ResourceList.Item>
              );
            }}
          />
        </>
      )}
    </>
  );
}

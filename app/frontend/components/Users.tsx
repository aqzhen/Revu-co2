import { Card, DataTable } from "@shopify/polaris";
import { User } from "~/globals";

export function Users({
  allUsersData,
  loaderData,
}: {
  allUsersData: User[];
  loaderData: any;
}) {
  return (
    <>
      {allUsersData.map((user, index) => (
        <div key={index}>
          <Card>
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
                  (row: string[][]) => [
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
                  ]
                )}
              />
            </div>
          </Card>
        </div>
      ))}
    </>
  );
}

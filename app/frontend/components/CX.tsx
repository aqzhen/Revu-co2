import { Button, Card, Checkbox, Tabs } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import { Query, SupportTicket, SupportTicketChat } from "~/globals";
import dynamic from "next/dynamic";
import { MessageContent } from "deep-chat/dist/types/messages";

export function CX({
  cxQueriesList,
  productId,
}: {
  cxQueriesList: Query[];
  productId: number;
}) {
  const DeepChat = dynamic(
    () => import("deep-chat-react").then((mod) => mod.DeepChat),
    { ssr: false }
  );
  // CX Queries
  const [cxQueriesListDetails, setcxQueriesListDetails] = useState<Query[]>([]); // used to store the entire list of queries for a product
  const [cxQueriesCheckbox, setcxQueriesCheckbox] = useState<
    Map<number, boolean>
  >(new Map());
  const [automatedAnswer, setAutomatedAnswer] = useState<string>(""); // used to store the entire list of queries for a product

  // FAQ Documents
  const [faqString, setFaqString] = useState<string>("");
  const [faqStrings, setFaqStrings] = useState<string[]>([]);

  // Tickets
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [currTicket, setCurrTicket] = useState<SupportTicket | null>(null);
  const [initialMessages, setInitialMessages] = useState<MessageContent[]>([]);

  // Tabs
  var [selectedTab, setSelectedTab] = useState<number>(0);
  var [viewChat, setViewChat] = useState<boolean>(false);

  useEffect(() => {
    if (productId === -1) {
      setcxQueriesListDetails(cxQueriesList);
    } else {
      setcxQueriesListDetails(
        cxQueriesList.filter((query) => query.productId === productId)
      );
    }
  }, [cxQueriesList, productId]);

  let messages;

  const handleTabChange = useCallback(async (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    if (selectedTabIndex === 0) {
      try {
        const requestData = {
          status: "open",
        };
        const response = await fetch("/cx/getSupportTickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });
        const data = await response.json();
        const supportTickets: SupportTicket[] = data;
        setSupportTickets(supportTickets);
      } catch (error) {
        // Handle any errors
        console.error(error);
      }
    } else if (selectedTabIndex === 1) {
      setViewChat(false);
    }
  }, []);

  useEffect(() => {
    if (currTicket) {
      const timer = setInterval(() => {
        getSupportTicketChats(currTicket.ticketId);
      }, 60000); // Update every 5 seconds

      return () => {
        clearInterval(timer); // Clear the timer when the component unmounts
      };
    }
  }, [currTicket]);

  const getSupportTicketChats = async (ticketId: number) => {
    try {
      const requestData = {
        ticketId: ticketId,
      };
      const response = await fetch("/cx/getTicketChats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      const data = await response.json();
      console.log(data);
      const supportTicketChats: SupportTicketChat[] = data;

      const messages = supportTicketChats.map((chat) => ({
        role: chat.userId == -1 ? "user" : "ai",
        text: new Date(chat.createdAt).toLocaleString() + ": " + chat.message,
      }));

      setInitialMessages(messages);
    } catch (error) {
      // Handle any errors
      console.error(error);
    }
  };

  const tabs = [
    {
      id: "tickets-1",
      content: "Tickets",
      accessibilityLabel: "Tickets",
      panelID: "tickets-content-1",
    },
    {
      id: "automations-1",
      content: "Automations",
      panelID: "automations-content-1",
    },
  ];

  return (
    <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
      {selectedTab === 0 &&
        (!viewChat ? (
          <div>
            {supportTickets.map((ticket: SupportTicket, index: number) => (
              <Card key={index}>
                <p>Ticket ID: {ticket.ticketId}</p>
                <p>Customer ID: {ticket.customerId}</p>
                <p>Product ID: {ticket.productId}</p>
                <p>Email: {ticket.email}</p>
                <p>Query: {ticket.query}</p>
                <p>Status: {ticket.status}</p>
                <p>Created At: {ticket.createdAt}</p>
                <Button
                  onClick={async () => {
                    setViewChat(true);
                    setCurrTicket(ticket);
                    getSupportTicketChats(ticket.ticketId);
                  }}
                >
                  View Ticket
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            <Button
              onClick={async () => {
                setViewChat(false);
              }}
            >
              Back
            </Button>

            <DeepChat
              style={{
                borderRadius: "10px",
                width: "60vw",
                height: "calc(100vh - 70px)",
                paddingTop: "10px",
              }}
              // messageStyles='{"default": {"shared": {"innerContainer": {"fontSize": "1rem"}}}}'
              // inputAreaStyle='{"fontSize": "1rem"}'
              names={{
                default: {
                  style: { fontSize: "14px", marginTop: "10px", width: "28px" },
                },
                user: { text: "You" },
                ai: { text: currTicket?.customerId.toString() },
                Revu: { style: { color: "green" } },
              }}
              request={{
                url: "/cx/sellerSendTicketResponse",
                method: "POST",
                additionalBodyProps: {
                  ticketId: currTicket?.ticketId,
                },
              }}
              textInput={{ placeholder: { text: "Send Message" } }}
              initialMessages={initialMessages}
            />
          </div>
        ))}

      {selectedTab === 1 && (
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
                console.log("Automating answer for queries: ", requestData);
                const response = await fetch("/supportQueries/automateAnswer", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(requestData),
                });

                await response.json();
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
                await fetch("/cx/addCorpusChunks", {
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
    </Tabs>
  );
}

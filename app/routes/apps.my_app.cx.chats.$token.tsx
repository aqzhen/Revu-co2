import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import dynamic from "next/dynamic";
import { SupportTicket, SupportTicketChat } from "~/globals";
import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { AppProxyProvider } from "@shopify/shopify-app-remix/react";
import { useLoaderData } from "@remix-run/react";
import {
  getSupportTicketChats,
  getTicketFromToken,
} from "~/backend/vectordb/get";
import { MessageContent } from "deep-chat/dist/types/messages";

// Load the DeepChat component dynamically without SSR
const DeepChat = dynamic(
  () => import("deep-chat-react").then((mod) => mod.DeepChat),
  {
    ssr: false,
  }
);

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request); // Assign value to 'session' variable

  const { token } = params;

  const ticket: SupportTicket | null = await getTicketFromToken(
    token as string
  );

  if (!ticket || !ticket.tokenExpiration) {
    throw new Error("Ticket not found");
  }

  if (new Date(ticket.tokenExpiration) < new Date()) {
    throw new Error("Token expired");
  }

  return {
    ticketId: ticket.ticketId,
    customerId: ticket.customerId,
    email: ticket.email,
    appUrl: process.env.SHOPIFY_APP_URL,
  };
};

export default function Chats() {
  const { token } = useParams<{ token: string }>();
  const [updatedMessages, setUpdatedMessages] = useState<MessageContent[]>([]);

  // Loader Data

  type LoaderData = {
    ticketId: number;
    customerId: number;
    email: string;
    appUrl: string;
  };

  const { ticketId, customerId, email, appUrl } = useLoaderData<LoaderData>();

  useEffect(() => {
    const fetchData = async () => {
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
        const supportTicketChats: SupportTicketChat[] = data;

        const messages = supportTicketChats.map((chat) => ({
          role: chat.userId == -1 ? "ai" : "user",
          text: new Date(chat.createdAt).toLocaleString() + ": " + chat.message,
        }));

        setUpdatedMessages(messages);
      } catch (error) {
        // Handle any errors
        console.error(error);
      }
    };

    fetchData(); // Call the function instantly

    // const interval = setInterval(fetchData, 60000);

    // return () => clearInterval(interval);
  }, []);

  if (ticketId === null) {
    return <div>Ticket Not Found...</div>;
  }

  return (
    <AppProxyProvider appUrl={appUrl as string}>
      <div>
        <h1>Chat</h1>
        <h2>Ticket #{ticketId}</h2>
      </div>

      <DeepChat
        style={{
          borderRadius: 10,
          width: "96vw",
          height: "calc(100vh - 70px)",
          paddingTop: 10,
        }}
        messageStyles={{
          default: {
            shared: { bubble: { borderRadius: "0px" } },
            user: { bubble: { backgroundColor: "#6c00ff" } },
          },
        }}
        avatars={true}
        inputAreaStyle={{ backgroundColor: "#eeeeee" }}
        textInput={{
          styles: {
            container: {
              backgroundColor: "white",
              borderRadius: "0px",
              boxShadow: "unset",
              width: "70%",
              marginLeft: "-40px",
            },
          },
        }}
        refreshMessages={() => {}}
        submitButtonStyles={{
          position: "outside-right",
          submit: {
            container: {
              default: {
                backgroundColor: "#5900ff",
                marginBottom: "0.1em",
                marginLeft: "10px",
                borderRadius: "0px",
              },
              hover: { backgroundColor: "#4d00dc" },
              click: { backgroundColor: "#3b00a8" },
            },
            text: {
              content: "Send",
              styles: {
                default: {
                  color: "white",
                  height: "1.78em",
                  width: "3em",
                  fontSize: "0.95em",
                },
              },
            },
          },
          loading: { container: { default: { backgroundColor: "#afafaf" } } },
          stop: {
            container: {
              default: { backgroundColor: "#919191" },
              hover: { backgroundColor: "#8c8c8c" },
              click: { backgroundColor: "#818181" },
            },
            text: { content: "Stop" },
          },
          disabled: { container: { default: { backgroundColor: "#afafaf" } } },
        }}
        names={{
          default: {
            style: { fontSize: "14px", marginTop: "10px", width: "28px" },
          },
          user: { text: "You" },
          ai: { text: "Tyrese from CO2" },
          Revu: { style: { color: "green" } },
        }}
        request={{
          url: "/cx/customerSendTicketResponse",
          method: "POST",
          additionalBodyProps: {
            ticketId: ticketId,
            userId: customerId,
            email: email,
            token: token,
          },
        }}
        initialMessages={updatedMessages}
      />
    </AppProxyProvider>
  );
}

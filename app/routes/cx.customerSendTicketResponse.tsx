import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { addSupportTicketChat } from "~/backend/vectordb/add";

export const loader = async ({ request }: LoaderFunctionArgs) => {};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { ticketId, userId, email, messages, token } = body;

  // check to see if token is valid
  const result = await singleStoreConnection.execute(
    `SELECT ticketId FROM Customer_Support_Tickets WHERE token = ?`,
    [token]
  );

  if (result[0].length === 0) {
    return { role: "Revu", text: "Invalid token" };
  }

  if (result[0][0].ticketId !== ticketId) {
    return { role: "Revu", text: "Token does not match ticket" };
  }

  // add chat to db
  addSupportTicketChat(ticketId, userId, email, messages[0].text);

  // TODO: call email service

  return { role: "Revu", text: "email successfully sent!" };
};

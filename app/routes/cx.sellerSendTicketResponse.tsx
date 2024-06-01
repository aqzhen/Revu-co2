import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { addSupportTicketChat } from "~/backend/vectordb/add";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {};
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const body = await request.json();
  const { ticketId, email, messages } = body;

  // add chat to db
  addSupportTicketChat(ticketId, -1, email, messages[0].text);

  // TODO: call email service

  return { role: "Revu", text: "email successfully sent!" };
};

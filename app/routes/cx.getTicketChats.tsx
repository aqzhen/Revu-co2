import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getSupportTicketChats } from "~/backend/vectordb/get";

export const loader = async ({ request }: LoaderFunctionArgs) => {};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { ticketId } = body;
  let chats = await getSupportTicketChats(ticketId);
  chats.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return chats;
};

import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getSupportTickets } from "~/backend/vectordb/get";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { status } = body;
  return await getSupportTickets(status);
};

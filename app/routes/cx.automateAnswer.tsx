import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { setAutomatedAnswer } from "~/backend/langchain/agents/supportAgent";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { queryIds, answer } = body;
  setAutomatedAnswer(queryIds, answer);
  return null;
};

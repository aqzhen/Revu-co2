import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getSegments } from "~/backend/vectordb/get";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  return await getSegments();
};

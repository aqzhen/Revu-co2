import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getCustomerSupportQueries } from "~/backend/vectordb/get";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  return getCustomerSupportQueries();
};

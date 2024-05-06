import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { addSegment } from "~/backend/vectordb/add";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { segment } = body;
  return await addSegment(segment);
};

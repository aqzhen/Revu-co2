import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getReviewChunksInfo } from "~/backend/vectordb/get";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { reviewIds, chunkNumbers } = body;
  return await getReviewChunksInfo(reviewIds, chunkNumbers);
};

import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  addReviewChunksToSingleStore,
  addReviewsToSingleStore,
} from "~/backend/vectordb/add";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { reviews } = body;
  addReviewsToSingleStore(reviews);
  console.log("About to try to add chunks");
  addReviewChunksToSingleStore(reviews);
};

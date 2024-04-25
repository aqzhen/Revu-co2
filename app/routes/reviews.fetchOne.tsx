import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { fetchJudgeReview } from "~/backend/api_calls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { reviewId } = body;
  return fetchJudgeReview(reviewId);
};

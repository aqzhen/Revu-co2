import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { createSegment } from "~/backend/dashboard/stratify/stratify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const {
    purchaseStatus,
    productId,
    semanticSegmentReview,
    semanticSegmentQuery,
    semanticSegmentCxQuery,
    overReviews,
    overQueries,
    overCxQueries,
  } = body;
  return await createSegment(
    purchaseStatus,
    productId,
    semanticSegmentReview,
    semanticSegmentQuery,
    semanticSegmentCxQuery,
    overReviews,
    overQueries,
    overCxQueries
  );
};

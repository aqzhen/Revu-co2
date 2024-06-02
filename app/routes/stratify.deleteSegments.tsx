import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { deleteSegment } from "~/backend/vectordb/delete";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { segmentIds } = body;

  for (const segmentId of segmentIds) {
    await deleteSegment(parseInt(segmentId));
  }
};

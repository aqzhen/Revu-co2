import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { getReviewPromptData } from "~/backend/dashboard/llms/reviewPromptLLM";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { userIds } = body;
  return await getReviewPromptData(userIds);
};

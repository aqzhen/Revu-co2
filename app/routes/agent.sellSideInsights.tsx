import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  call_purchasingCustomersInsightsLLM,
  call_windowShoppersInsightsLLM,
} from "~/backend/langchain/sellSideInsightsLLM";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { productId, selector, k } = body;
  console.log(productId);
  if (selector == "windowShoppers") {
    return await call_windowShoppersInsightsLLM(productId, k);
  } else if (selector == "purchasingCustomers") {
    return await call_purchasingCustomersInsightsLLM(productId, k);
  }

  return await call_windowShoppersInsightsLLM(productId, k);
};

import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { callCatalogSearchAgent } from "~/backend/langchain/agents/catalogSearchAgent";
import { callSupportAgent } from "~/backend/langchain/agents/supportAgent";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { customerId, productId, agentQuery, searchType } = body;

  let session;
  ({ session } = await authenticate.public.appProxy(request)); // Assign value to 'session' variable

  if (session) {
    console.log(session);
  }

  if (searchType == "catalog") {
    const result = await callCatalogSearchAgent(
      customerId,
      -1,
      agentQuery,
      false
    );
    return {
      html:
        JSON.stringify(result?.productDescriptionOutput) +
        JSON.stringify(result?.reviewsOutput),
    };
  } else if (searchType == "product") {
    const result = await callCatalogSearchAgent(
      customerId,
      productId,
      agentQuery,
      false
    );

    return {
      html:
        JSON.stringify(result?.productDescriptionOutput) +
        JSON.stringify(result?.reviewsOutput),
    };
  } else if (searchType == "support") {
    const result = await callSupportAgent(customerId, productId, agentQuery);

    return {
      html: result,
    };
  }
};

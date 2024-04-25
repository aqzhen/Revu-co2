import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { callProductAgent } from "~/backend/langchain/agents/productAgent";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { customerId, productId, agentQuery, userMode, tableToQuery, caller } =
    body;

  let session;
  if (caller == "seller") {
    ({ session } = await authenticate.admin(request)); // Assign value to 'session' variable
  } else if (caller == "user") {
    ({ session } = await authenticate.public.appProxy(request)); // Assign value to 'session' variable
  }

  if (session) {
    console.log(session);
  }

  return callProductAgent(
    customerId,
    productId,
    agentQuery,
    JSON.parse(userMode),
    tableToQuery
  );
};

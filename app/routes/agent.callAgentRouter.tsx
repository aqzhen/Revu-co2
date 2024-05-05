import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { text } from "stream/consumers";
import { callCatalogSearchAgent } from "~/backend/langchain/agents/catalogSearchAgent";
import { callSupportAgent } from "~/backend/langchain/agents/supportAgent";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ message: "Hello, world!" });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { customerId, email, productId, agentQuery, searchType } = body;

  let session;
  ({ session } = await authenticate.public.appProxy(request)); // Assign value to 'session' variable

  if (session) {
    console.log(session);
  }

  console.log(email);

  if (email == "" && customerId == null) {
    return {
      text: "You must enter a valid email address before I can help you:",
      html: "",
    };
  }

  if (searchType == "catalog") {
    const result = await callCatalogSearchAgent(
      customerId,
      -1,
      email,
      agentQuery,
      false
    );
    return {
      text: "",
      html:
        JSON.stringify(result?.productDescriptionOutput) +
        JSON.stringify(result?.reviewsOutput),
    };
  } else if (searchType == "product") {
    const result = await callCatalogSearchAgent(
      customerId,
      productId,
      email,
      agentQuery,
      false
    );

    return {
      text: "",
      html:
        JSON.stringify(result?.productDescriptionOutput) +
        JSON.stringify(result?.reviewsOutput),
    };
  } else if (searchType == "support") {
    const result = await callSupportAgent(
      customerId,
      productId,
      email,
      agentQuery
    );

    return {
      text: "",
      html: result,
    };
  } else if (searchType == "ticket") {
    // TODO: Implement ticketing system
    return {
      text: "Got it. You can sit back and relax now. I went ahead and submitted a ticket for you with all the relevant information. Someone from our team will get back to you shortly.",
      html: "",
    };
  } else {
    return {
      text: "Invalid search type. Select one of the Following:",
      html: "",
    };
  }
};

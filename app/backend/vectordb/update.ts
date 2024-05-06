import { HashFormat, hashString } from "@shopify/shopify-api/runtime";
import { RowDataPacket } from "mysql2";
import {
  getCustomerIdFromEmail,
  getCustomerProductPurchases,
} from "../api_calls";

export async function updatePurchasedStatus() {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
          SELECT userId, productId FROM Purchases WHERE purchased = 0
        `
    );
    const rows = results as RowDataPacket[];
    const userIds: number[] = [];
    const productIds: number[] = [];
    rows.forEach((row) => {
      if (row.userId != 0) {
        userIds.push(row.userId);
      }
      productIds.push(row.productId);
    });

    // console.log("User ID, productId", userIds[0], productIds[0]);

    // get the purchased products for each userId with call to shopify api
    for (let i = 0; i < userIds.length; i++) {
      let userId = userIds[i];
      let productId = productIds[i];
      let purchasedProducts = await (
        await getCustomerProductPurchases(userId)
      ).json();

      // console.log(
      //   "Purchased products for user " + userId + " are: ",
      //   purchasedProducts
      // );

      // attempt to match purchased products of each user with productId in productIds array
      // if match, update purchased status to 1

      // console.log(productId + "  " + purchasedProducts.productIds);
      if (
        purchasedProducts.productIds &&
        purchasedProducts.productIds.includes(productId)
      ) {
        // console.log("Match found for user " + userId);
        const [results, buff] = await singleStoreConnection.execute(
          `
              UPDATE Purchases
              SET purchased = 1
              WHERE userId = ? AND productId = ?
            `,
          [userId, productId]
        );
      }
    }
    console.log("Updated purchased status successfully.");
    return null;
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

// function to update dummy hashed userIds in Users, Purchases, and queries/customerSupportQueries tables to match ground truth Shopify userIds based off of shared email values
export async function updateExistingUsers() {
  try {
    const [results, buff] = await singleStoreConnection.execute(
      `
          SELECT userId, email FROM Users
        `
    );
    const rows = results as RowDataPacket[];
    const userIds: number[] = [];
    const emails: string[] = [];
    rows.forEach((row) => {
      userIds.push(row.userId);
      emails.push(row.email);
    });

    // console.log("User ID, email", userIds[0], emails[0]);

    // get the purchased products for each userId with call to shopify api
    for (let i = 0; i < userIds.length; i++) {
      let userId = userIds[i];
      let email = emails[i];

      // if userId is not a dummy value, skip
      if (userId != parseInt(hashString(email, HashFormat.Base64))) {
        continue;
      }

      let shopifyUserId = (await getCustomerIdFromEmail(email)).id.replace(
        "gid://shopify/Customer/",
        ""
      );

      console.log(
        "Shopify user ID for email " + email + " is: ",
        shopifyUserId
      );

      // update userId in Users, Purchases, and queries/customerSupportQueries tables

      // this row already exists, when the customer is finally registered (has a userId and email)
      const [results, buff] = await singleStoreConnection.execute(
        `
        DELETE FROM Users
        WHERE userId = ? AND email = ?
          `,
        [userId, email]
      );

      const [results2, buff2] = await singleStoreConnection.execute(
        `
            UPDATE Purchases
            SET userId = ?
            WHERE userId = ?
          `,
        [shopifyUserId, userId]
      );

      const [results3, buff3] = await singleStoreConnection.execute(
        `
            UPDATE Queries
            SET userId = ?
            WHERE userId = ?
          `,
        [shopifyUserId, userId]
      );

      const [results4, buff4] = await singleStoreConnection.execute(
        `
            UPDATE Customer_Support_Queries
            SET userId = ?
            WHERE userId = ?
          `,
        [shopifyUserId, userId]
      );
    }
    console.log("Updated existing users successfully.");
    return null;
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}

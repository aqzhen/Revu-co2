import { RowDataPacket } from "mysql2";
import { getCustomerProductPurchases } from "../api_calls";

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

    console.log("User ID, productId", userIds[0], productIds[0]);

    // get the purchased products for each userId with call to shopify api
    for (let i = 0; i < userIds.length; i++) {
      let userId = userIds[i];
      let productId = productIds[i];
      let purchasedProducts = await (
        await getCustomerProductPurchases(userId)
      ).json();

      console.log(
        "Purchased products for user " + userId + " are: ",
        purchasedProducts
      );

      // attempt to match purchased products of each user with productId in productIds array
      // if match, update purchased status to 1

      console.log(productId + "  " + purchasedProducts.productIds);
      if (
        purchasedProducts.productIds &&
        purchasedProducts.productIds.includes(productId)
      ) {
        console.log("Match found for user " + userId);
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

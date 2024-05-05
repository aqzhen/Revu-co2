export enum PurchaseStatus {
  WINDOW, // queried, didn't add to cart
  ABANDONEDCART, // added to cart, didn't purchase
  PURCHASED,
}

export async function createSegment(
  purchaseStatus: PurchaseStatus,
  productID: number = -1,
  semanticSegment: string
) {}

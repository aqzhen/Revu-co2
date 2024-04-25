import { Review } from "../globals";

export function parseReviewsData(reviews: any) {
  return reviews.map((review: any) => ({
    reviewId: review.id,
    productId: review.product_external_id,
    title: review.title,
    body: review.body,
    rating: review.rating,
    reviewerExternalId: review.reviewer.external_id,
    reviewerName: review.reviewer.name,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
    verified: review.verified,
  })) as Review[];
}

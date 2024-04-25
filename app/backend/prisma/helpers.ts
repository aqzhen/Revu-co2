import prisma from "../../db.server";
import { Review } from "../../globals";

export async function addReviewsToDatabase(
  productId: number,
  reviews: Review[],
): Promise<void> {
  try {
    for (const review of reviews) {
      await prisma.review.upsert({
        where: {
          productId_reviewId: {
            productId: productId,
            reviewId: review.reviewId,
          },
        },
        create: {
          productId: productId,
          reviewId: review.reviewId,
          reviewerName: review.reviewerName,
          reviewerExternalId: review.reviewerExternalId,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
          verified: review.verified,
          rating: review.rating,
          title: review.title,
          body: review.body,
        },
        update: {},
      });
      console.log("Review added to the database successfully.");
    }
  } catch (error) {
    console.error("Error adding review to the database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

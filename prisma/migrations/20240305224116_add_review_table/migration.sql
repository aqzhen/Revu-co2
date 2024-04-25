-- CreateTable
CREATE TABLE "Review" (
    "productId" INTEGER NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerExternalId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "verified" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    PRIMARY KEY ("productId", "reviewId")
);

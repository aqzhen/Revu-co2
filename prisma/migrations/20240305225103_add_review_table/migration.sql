/*
  Warnings:

  - The primary key for the `Review` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "productId" INTEGER NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerExternalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "verified" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    PRIMARY KEY ("productId", "reviewId")
);
INSERT INTO "new_Review" ("body", "createdAt", "productId", "rating", "reviewId", "reviewerExternalId", "reviewerName", "title", "updatedAt", "verified") SELECT "body", "createdAt", "productId", "rating", "reviewId", "reviewerExternalId", "reviewerName", "title", "updatedAt", "verified" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

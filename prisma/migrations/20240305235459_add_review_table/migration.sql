/*
  Warnings:

  - The primary key for the `Review` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `reviewId` on the `Review` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "productId" INTEGER NOT NULL,
    "reviewId" INTEGER NOT NULL,
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

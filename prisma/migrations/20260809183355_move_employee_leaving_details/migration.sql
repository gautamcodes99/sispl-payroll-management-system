/*
  Warnings:

  - You are about to drop the column `leftDate` on the `Site` table. All the data in the column will be lost.
  - You are about to drop the column `leftReason` on the `Site` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Site" DROP COLUMN "leftDate",
DROP COLUMN "leftReason";

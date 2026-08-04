/*
  Warnings:

  - You are about to drop the column `employeeCode` on the `Employee` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Employee_employeeCode_key";

-- AlterTable
ALTER TABLE "public"."Employee" DROP COLUMN "employeeCode";

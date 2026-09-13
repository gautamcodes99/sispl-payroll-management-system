/*
  Warnings:

  - A unique constraint covering the columns `[siteId,employeeId,financialYear]` on the table `BonusPayment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[siteId,employeeId,leaveYear]` on the table `LeavePayment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."BonusPayment_employeeId_financialYear_key";

-- DropIndex
DROP INDEX "public"."LeavePayment_employeeId_leaveYear_key";

-- AlterTable
ALTER TABLE "public"."BonusPayment" ADD COLUMN     "siteId" INTEGER;

-- AlterTable
ALTER TABLE "public"."LeavePayment" ADD COLUMN     "siteId" INTEGER;

-- Legacy backfill
--
-- Audited LeavePayment rows:
-- Employee 4 / Leave Year 2026 -> Site 5
-- Employee 5 / Leave Year 2026 -> Site 5
--
-- Employees 1 and 3 intentionally remain NULL because their
-- historical Site cannot be derived unambiguously/safely.
UPDATE "public"."LeavePayment"
SET "siteId" = 5
WHERE "leaveYear" = 2026
  AND "employeeId" IN (4, 5)
  AND "siteId" IS NULL;

-- CreateIndex
CREATE INDEX "BonusPayment_siteId_financialYear_status_idx" ON "public"."BonusPayment"("siteId", "financialYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BonusPayment_siteId_employeeId_financialYear_key" ON "public"."BonusPayment"("siteId", "employeeId", "financialYear");

-- CreateIndex
CREATE INDEX "LeavePayment_siteId_leaveYear_status_idx" ON "public"."LeavePayment"("siteId", "leaveYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePayment_siteId_employeeId_leaveYear_key" ON "public"."LeavePayment"("siteId", "employeeId", "leaveYear");

-- AddForeignKey
ALTER TABLE "public"."LeavePayment" ADD CONSTRAINT "LeavePayment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BonusPayment" ADD CONSTRAINT "BonusPayment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

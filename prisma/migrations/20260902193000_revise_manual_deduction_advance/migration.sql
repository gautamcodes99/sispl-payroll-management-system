-- AlterTable
ALTER TABLE "public"."ManualDeduction"
ADD COLUMN "newAdvance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "numberOfInstallments" INTEGER NOT NULL DEFAULT 0;

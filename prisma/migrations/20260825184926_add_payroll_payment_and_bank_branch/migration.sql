-- CreateEnum
CREATE TYPE "public"."PayrollPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "public"."PayrollPaymentMode" AS ENUM ('BANK_TRANSFER', 'CHEQUE');

-- AlterTable
ALTER TABLE "public"."Employee" ADD COLUMN     "bankBranch" TEXT;

-- AlterTable
ALTER TABLE "public"."PayrollEmployeeSnapshot" ADD COLUMN     "bankBranch" TEXT;

-- CreateTable
CREATE TABLE "public"."PayrollPayment" (
    "id" SERIAL NOT NULL,
    "payrollSnapshotId" INTEGER NOT NULL,
    "status" "public"."PayrollPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDate" TIMESTAMP(3),
    "paymentMode" "public"."PayrollPaymentMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_payrollSnapshotId_key" ON "public"."PayrollPayment"("payrollSnapshotId");

-- CreateIndex
CREATE INDEX "PayrollPayment_status_idx" ON "public"."PayrollPayment"("status");

-- AddForeignKey
ALTER TABLE "public"."PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollSnapshotId_fkey" FOREIGN KEY ("payrollSnapshotId") REFERENCES "public"."PayrollEmployeeSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

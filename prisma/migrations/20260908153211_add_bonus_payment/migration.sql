-- CreateEnum
CREATE TYPE "public"."BonusPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "public"."BonusPaymentMode" AS ENUM ('NEFT', 'CMS', 'NET_BANKING', 'CHEQUE');

-- CreateTable
CREATE TABLE "public"."BonusPayment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "status" "public"."BonusPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDate" TIMESTAMP(3),
    "paymentMode" "public"."BonusPaymentMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusPayment_financialYear_status_idx" ON "public"."BonusPayment"("financialYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BonusPayment_employeeId_financialYear_key" ON "public"."BonusPayment"("employeeId", "financialYear");

-- AddForeignKey
ALTER TABLE "public"."BonusPayment" ADD CONSTRAINT "BonusPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

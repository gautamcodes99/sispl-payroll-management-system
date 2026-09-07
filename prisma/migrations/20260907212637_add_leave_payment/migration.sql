-- CreateEnum
CREATE TYPE "public"."LeavePaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "public"."LeavePaymentMode" AS ENUM ('NEFT', 'CMS', 'NET_BANKING', 'CHEQUE');

-- CreateTable
CREATE TABLE "public"."LeavePayment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "leaveYear" INTEGER NOT NULL,
    "status" "public"."LeavePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDate" TIMESTAMP(3),
    "paymentMode" "public"."LeavePaymentMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeavePayment_leaveYear_status_idx" ON "public"."LeavePayment"("leaveYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePayment_employeeId_leaveYear_key" ON "public"."LeavePayment"("employeeId", "leaveYear");

-- AddForeignKey
ALTER TABLE "public"."LeavePayment" ADD CONSTRAINT "LeavePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

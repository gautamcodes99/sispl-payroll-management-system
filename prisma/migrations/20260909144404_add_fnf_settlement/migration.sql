-- CreateTable
CREATE TABLE "public"."FnFSettlement" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "uniformShoesRecovery" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherPermissibleDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FnFSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FnFSettlement_employeeId_key" ON "public"."FnFSettlement"("employeeId");

-- AddForeignKey
ALTER TABLE "public"."FnFSettlement" ADD CONSTRAINT "FnFSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

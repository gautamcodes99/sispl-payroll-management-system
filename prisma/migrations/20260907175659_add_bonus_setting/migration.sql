-- CreateTable
CREATE TABLE "public"."BonusSetting" (
    "id" SERIAL NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "cappingAmount" DECIMAL(14,2) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonusSetting_financialYear_key" ON "public"."BonusSetting"("financialYear");

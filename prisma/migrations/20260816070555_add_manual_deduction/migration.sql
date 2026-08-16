-- CreateTable
CREATE TABLE "public"."ManualDeduction" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "salaryMonth" TIMESTAMP(3) NOT NULL,
    "advanceRecovery" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "canteen" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transport" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uniformRecovery" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualDeduction_salaryMonth_idx" ON "public"."ManualDeduction"("salaryMonth");

-- CreateIndex
CREATE INDEX "ManualDeduction_employeeId_idx" ON "public"."ManualDeduction"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualDeduction_employeeId_salaryMonth_key" ON "public"."ManualDeduction"("employeeId", "salaryMonth");

-- AddForeignKey
ALTER TABLE "public"."ManualDeduction" ADD CONSTRAINT "ManualDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

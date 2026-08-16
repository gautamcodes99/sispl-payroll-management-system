-- CreateTable
CREATE TABLE "public"."VariableAllowance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "salaryMonth" TIMESTAMP(3) NOT NULL,
    "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "arrears" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rab" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariableAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariableAllowance_salaryMonth_idx" ON "public"."VariableAllowance"("salaryMonth");

-- CreateIndex
CREATE INDEX "VariableAllowance_employeeId_idx" ON "public"."VariableAllowance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "VariableAllowance_employeeId_salaryMonth_key" ON "public"."VariableAllowance"("employeeId", "salaryMonth");

-- AddForeignKey
ALTER TABLE "public"."VariableAllowance" ADD CONSTRAINT "VariableAllowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "public"."PayrollRunStatus" AS ENUM ('FINALIZED', 'UNLOCKED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "public"."PayrollRun" (
    "id" SERIAL NOT NULL,
    "salaryMonth" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "public"."PayrollRunStatus" NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollEmployeeSnapshot" (
    "id" SERIAL NOT NULL,
    "payrollRunId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "wageMasterId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "gender" TEXT,
    "designationId" INTEGER NOT NULL,
    "designationName" TEXT NOT NULL,
    "siteId" INTEGER NOT NULL,
    "siteName" TEXT NOT NULL,
    "wageMasterVersion" INTEGER NOT NULL,
    "presentDays" DECIMAL(5,1) NOT NULL,
    "halfDays" DECIMAL(5,1) NOT NULL,
    "paidHolidays" DECIMAL(5,1) NOT NULL,
    "payableDays" DECIMAL(5,1) NOT NULL,
    "otHours" DECIMAL(8,2) NOT NULL,
    "monthlyBasic" DECIMAL(14,2) NOT NULL,
    "monthlyDa" DECIMAL(14,2) NOT NULL,
    "earnedBasic" DECIMAL(14,2) NOT NULL,
    "earnedDa" DECIMAL(14,2) NOT NULL,
    "wages" DECIMAL(14,2) NOT NULL,
    "hraPercentage" DECIMAL(5,2) NOT NULL,
    "hra" DECIMAL(14,2) NOT NULL,
    "otRate" DECIMAL(14,2) NOT NULL,
    "otAmount" DECIMAL(14,2) NOT NULL,
    "conveyance" DECIMAL(14,2) NOT NULL,
    "specialAllowanceRate" DECIMAL(14,2),
    "specialAllowanceMinDays" DECIMAL(5,1),
    "specialAllowanceMaxDays" DECIMAL(5,1),
    "specialAllowanceAmount" DECIMAL(14,2) NOT NULL,
    "rab" DECIMAL(14,2) NOT NULL,
    "arrears" DECIMAL(14,2) NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "pf" DECIMAL(14,2) NOT NULL,
    "esic" DECIMAL(14,2) NOT NULL,
    "ptax" DECIMAL(14,2) NOT NULL,
    "mlwf" DECIMAL(14,2) NOT NULL,
    "statutoryDeductionTotal" DECIMAL(14,2) NOT NULL,
    "advanceRecovery" DECIMAL(14,2) NOT NULL,
    "canteen" DECIMAL(14,2) NOT NULL,
    "transport" DECIMAL(14,2) NOT NULL,
    "uniformRecovery" DECIMAL(14,2) NOT NULL,
    "fine" DECIMAL(14,2) NOT NULL,
    "otherDeduction" DECIMAL(14,2) NOT NULL,
    "manualDeductionTotal" DECIMAL(14,2) NOT NULL,
    "totalDeductions" DECIMAL(14,2) NOT NULL,
    "netSalary" DECIMAL(14,2) NOT NULL,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEmployeeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_salaryMonth_status_idx" ON "public"."PayrollRun"("salaryMonth", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_salaryMonth_version_key" ON "public"."PayrollRun"("salaryMonth", "version");

-- CreateIndex
CREATE INDEX "PayrollEmployeeSnapshot_employeeId_idx" ON "public"."PayrollEmployeeSnapshot"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeSnapshot_wageMasterId_idx" ON "public"."PayrollEmployeeSnapshot"("wageMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEmployeeSnapshot_payrollRunId_employeeId_key" ON "public"."PayrollEmployeeSnapshot"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "public"."PayrollEmployeeSnapshot" ADD CONSTRAINT "PayrollEmployeeSnapshot_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "public"."PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollEmployeeSnapshot" ADD CONSTRAINT "PayrollEmployeeSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollEmployeeSnapshot" ADD CONSTRAINT "PayrollEmployeeSnapshot_wageMasterId_fkey" FOREIGN KEY ("wageMasterId") REFERENCES "public"."WageMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

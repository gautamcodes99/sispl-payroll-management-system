-- Preserve historical payroll snapshot values.
-- Widen precision without recalculating records.

ALTER TABLE "PayrollEmployeeSnapshot"
  ALTER COLUMN "esic" TYPE DECIMAL(18,6),
  ALTER COLUMN "statutoryDeductionTotal" TYPE DECIMAL(18,6),
  ALTER COLUMN "totalDeductions" TYPE DECIMAL(18,6),
  ALTER COLUMN "netSalary" TYPE DECIMAL(18,6);
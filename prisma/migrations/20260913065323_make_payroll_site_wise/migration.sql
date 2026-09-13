-- =========================================================
-- SITE-WISE PAYROLL FOUNDATION
--
-- Existing historical/global records are preserved.
--
-- siteId remains nullable at database level so legacy rows
-- whose Site cannot be determined safely are not fabricated.
--
-- New application operations will require and validate Site
-- in the Service layer.
-- =========================================================


-- =========================================================
-- ADD SITE COLUMNS
-- =========================================================

ALTER TABLE "public"."VariableAllowance"
ADD COLUMN "siteId" INTEGER;

ALTER TABLE "public"."ManualDeduction"
ADD COLUMN "siteId" INTEGER;

ALTER TABLE "public"."PayrollRun"
ADD COLUMN "siteId" INTEGER;


-- =========================================================
-- SAFE LEGACY BACKFILL:
-- VARIABLE ALLOWANCE
--
-- Backfill only when the employee has attendance belonging
-- to exactly one distinct Site in that salary month.
--
-- Multiple Sites = remain NULL.
-- No Site        = remain NULL.
-- =========================================================

UPDATE "public"."VariableAllowance" AS va
SET "siteId" = mapped."siteId"
FROM (
    SELECT
        va2."id" AS "variableAllowanceId",
        MIN(wt."siteId") AS "siteId"
    FROM "public"."VariableAllowance" AS va2
    INNER JOIN "public"."Attendance" AS a
        ON a."employeeId" = va2."employeeId"
       AND a."attendanceDate" >= va2."salaryMonth"
       AND a."attendanceDate" < va2."salaryMonth" + INTERVAL '1 month'
    INNER JOIN "public"."Department" AS d
        ON d."id" = a."departmentId"
    INNER JOIN "public"."WorkType" AS wt
        ON wt."id" = d."workTypeId"
    GROUP BY va2."id"
    HAVING COUNT(DISTINCT wt."siteId") = 1
) AS mapped
WHERE va."id" = mapped."variableAllowanceId";


-- =========================================================
-- SAFE LEGACY BACKFILL:
-- MANUAL DEDUCTION
--
-- Same rule:
-- exactly one attendance Site for employee + salary month.
-- =========================================================

UPDATE "public"."ManualDeduction" AS md
SET "siteId" = mapped."siteId"
FROM (
    SELECT
        md2."id" AS "manualDeductionId",
        MIN(wt."siteId") AS "siteId"
    FROM "public"."ManualDeduction" AS md2
    INNER JOIN "public"."Attendance" AS a
        ON a."employeeId" = md2."employeeId"
       AND a."attendanceDate" >= md2."salaryMonth"
       AND a."attendanceDate" < md2."salaryMonth" + INTERVAL '1 month'
    INNER JOIN "public"."Department" AS d
        ON d."id" = a."departmentId"
    INNER JOIN "public"."WorkType" AS wt
        ON wt."id" = d."workTypeId"
    GROUP BY md2."id"
    HAVING COUNT(DISTINCT wt."siteId") = 1
) AS mapped
WHERE md."id" = mapped."manualDeductionId";


-- =========================================================
-- SAFE LEGACY BACKFILL:
-- PAYROLL RUN
--
-- A historical Payroll Run receives a Site only when:
--
-- 1. It contains snapshots.
-- 2. Every snapshot already has a non-null siteId.
-- 3. Every snapshot belongs to exactly the same Site.
--
-- Otherwise the old Payroll Run remains a legacy global run.
-- =========================================================

UPDATE "public"."PayrollRun" AS pr
SET "siteId" = mapped."siteId"
FROM (
    SELECT
        pes."payrollRunId",
        MIN(pes."siteId") AS "siteId"
    FROM "public"."PayrollEmployeeSnapshot" AS pes
    GROUP BY pes."payrollRunId"
    HAVING COUNT(*) > 0
       AND COUNT(*) = COUNT(pes."siteId")
       AND COUNT(DISTINCT pes."siteId") = 1
) AS mapped
WHERE pr."id" = mapped."payrollRunId";


-- =========================================================
-- INDEXES FOR SITE-WISE MONTHLY ACCESS
-- =========================================================

CREATE INDEX "VariableAllowance_siteId_salaryMonth_idx"
ON "public"."VariableAllowance"("siteId", "salaryMonth");

CREATE INDEX "ManualDeduction_siteId_salaryMonth_idx"
ON "public"."ManualDeduction"("siteId", "salaryMonth");

CREATE INDEX "PayrollRun_siteId_salaryMonth_status_idx"
ON "public"."PayrollRun"("siteId", "salaryMonth", "status");


-- =========================================================
-- FOREIGN KEYS
-- =========================================================

ALTER TABLE "public"."VariableAllowance"
ADD CONSTRAINT "VariableAllowance_siteId_fkey"
FOREIGN KEY ("siteId")
REFERENCES "public"."Site"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "public"."ManualDeduction"
ADD CONSTRAINT "ManualDeduction_siteId_fkey"
FOREIGN KEY ("siteId")
REFERENCES "public"."Site"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "public"."PayrollRun"
ADD CONSTRAINT "PayrollRun_siteId_fkey"
FOREIGN KEY ("siteId")
REFERENCES "public"."Site"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


-- =========================================================
-- PAYROLL RUN VERSIONING
--
-- OLD:
-- salaryMonth + version
--
-- NEW:
-- Site + salaryMonth + version
--
-- Nullable siteId remains supported only for preserved
-- legacy global Payroll Runs.
-- =========================================================

DROP INDEX "public"."PayrollRun_salaryMonth_version_key";

CREATE UNIQUE INDEX "PayrollRun_siteId_salaryMonth_version_key"
ON "public"."PayrollRun"("siteId", "salaryMonth", "version");
-- =========================================================
-- COMPANY-WIDE DESIGNATION MIGRATION
--
-- Business rule:
-- Designation is company-wide and no longer belongs to Site.
--
-- Data preservation:
-- - Designation ID 1 becomes the canonical "Unskilled".
-- - Employees currently using duplicate Designation ID 4
--   are moved to Designation ID 1.
-- - Designation ID 4 is retained as an INACTIVE legacy
--   designation because historical Wage Masters still point
--   to it.
-- - Historical Wage Masters and Payroll snapshots are NOT
--   deleted or rewritten.
-- =========================================================


-- =========================================================
-- 1. MOVE EMPLOYEES FROM DUPLICATE UNSKILLED TO CANONICAL
-- =========================================================

UPDATE "public"."Employee"
SET "designationId" = 1
WHERE "designationId" = 4;


-- =========================================================
-- 2. PRESERVE OLD DESIGNATION AS LEGACY
--
-- Wage Masters 1 and 2 remain attached to this record.
-- Renaming avoids conflict with the new company-wide unique
-- designationName constraint.
-- =========================================================

UPDATE "public"."Designation"
SET
  "designationName" = 'LEGACY_UNSKILLED_SITE_6',
  "status" = 'INACTIVE'
WHERE "id" = 4
  AND "designationName" = 'Unskilled';


-- =========================================================
-- 3. REMOVE SITE -> DESIGNATION RELATIONSHIP
-- =========================================================

ALTER TABLE "public"."Designation"
DROP CONSTRAINT "Designation_siteId_fkey";


-- =========================================================
-- 4. REMOVE OLD SITE-SCOPED UNIQUE CONSTRAINT
-- =========================================================

DROP INDEX "public"."Designation_siteId_designationName_key";


-- =========================================================
-- 5. REMOVE siteId FROM DESIGNATION
-- =========================================================

ALTER TABLE "public"."Designation"
DROP COLUMN "siteId";


-- =========================================================
-- 6. PAYROLL SNAPSHOT SITE BECOMES OPTIONAL
--
-- Existing historical values are preserved.
-- Future payroll runs are no longer required to fabricate a
-- Site from Designation.
-- =========================================================

ALTER TABLE "public"."PayrollEmployeeSnapshot"
ALTER COLUMN "siteId" DROP NOT NULL,
ALTER COLUMN "siteName" DROP NOT NULL;


-- =========================================================
-- 7. DESIGNATION NAME IS NOW COMPANY-WIDE UNIQUE
-- =========================================================

CREATE UNIQUE INDEX "Designation_designationName_key"
ON "public"."Designation"("designationName");
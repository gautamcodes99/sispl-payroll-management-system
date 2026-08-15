/*
  Move Designation ownership from Department to Site.

  Historical architecture:
    Department -> Designation

  Current locked architecture:
    Site -> Designation

  The siteId is derived through:
    Designation.departmentId
      -> Department.workTypeId
      -> WorkType.siteId
*/

-- Add the new Site relationship column first.
ALTER TABLE "public"."Designation"
ADD COLUMN "siteId" INTEGER;

-- Populate siteId from the existing hierarchy.
UPDATE "public"."Designation" AS designation
SET "siteId" = work_type."siteId"
FROM "public"."Department" AS department
JOIN "public"."WorkType" AS work_type
  ON work_type."id" = department."workTypeId"
WHERE department."id" = designation."departmentId";

-- siteId is required in the final architecture.
ALTER TABLE "public"."Designation"
ALTER COLUMN "siteId" SET NOT NULL;

-- Remove the old Department-based foreign key.
ALTER TABLE "public"."Designation"
DROP CONSTRAINT "Designation_departmentId_fkey";

-- Remove the old Department-based unique constraint.
DROP INDEX "public"."Designation_departmentId_designationName_key";

-- Remove the old Department relationship.
ALTER TABLE "public"."Designation"
DROP COLUMN "departmentId";

-- Add the new Site-based unique constraint.
CREATE UNIQUE INDEX "Designation_siteId_designationName_key"
ON "public"."Designation"("siteId", "designationName");

-- Add the new Site foreign key.
ALTER TABLE "public"."Designation"
ADD CONSTRAINT "Designation_siteId_fkey"
FOREIGN KEY ("siteId")
REFERENCES "public"."Site"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
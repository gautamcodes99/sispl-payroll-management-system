BEGIN;

-- 1. Add the new Site relationship column temporarily as nullable.
ALTER TABLE "Designation"
ADD COLUMN IF NOT EXISTS "siteId" INTEGER;

-- 2. Populate siteId from the existing relationship:
--    Designation -> Department -> WorkType -> Site
UPDATE "Designation" d
SET "siteId" = s."id"
FROM "Department" dep
JOIN "WorkType" wt ON wt."id" = dep."workTypeId"
JOIN "Site" s ON s."id" = wt."siteId"
WHERE d."departmentId" = dep."id"
  AND d."siteId" IS NULL;

-- 3. Make sure every existing designation received a Site.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Designation"
    WHERE "siteId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migration stopped: one or more Designations could not be assigned to a Site.';
  END IF;
END $$;

-- 4. Make siteId mandatory.
ALTER TABLE "Designation"
ALTER COLUMN "siteId" SET NOT NULL;

-- 5. Remove the old Department foreign-key constraint.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = '"Designation"'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%("departmentId")%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE "Designation" DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

-- 6. Remove the old departmentId column.
ALTER TABLE "Designation"
DROP COLUMN IF EXISTS "departmentId";

-- 7. Add the new Site foreign-key constraint.
ALTER TABLE "Designation"
ADD CONSTRAINT "Designation_siteId_fkey"
FOREIGN KEY ("siteId")
REFERENCES "Site"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 8. Remove the old Department/Designation unique constraint or index.
DO $$
DECLARE
  index_name TEXT;
BEGIN
  SELECT indexname
  INTO index_name
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'Designation'
    AND indexdef LIKE '%"departmentId"%'
    AND indexdef LIKE '%"designationName"%'
  LIMIT 1;

  IF index_name IS NOT NULL THEN
    EXECUTE format(
      'DROP INDEX IF EXISTS %I',
      index_name
    );
  END IF;
END $$;

-- 9. Designation names must be unique within a Site.
CREATE UNIQUE INDEX IF NOT EXISTS
"Designation_siteId_designationName_key"
ON "Designation"("siteId", "designationName");

COMMIT;
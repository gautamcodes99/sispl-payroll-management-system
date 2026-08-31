-- =========================================================
-- DAILY ATTENDANCE / DAILY OT ATTENDANCE SEPARATION
--
-- Historical migration rules:
-- 1. Existing Attendance rows did not store worked designation.
--    Use Employee.designationId as the historical fallback.
-- 2. Existing Attendance.otHours values are copied into the new
--    OtAttendance table.
-- 3. Attendance.otHours is intentionally preserved temporarily.
-- =========================================================


-- ---------------------------------------------------------
-- 1. ADD WORKED DESIGNATION TO DAILY ATTENDANCE
--
-- Add it nullable first because Attendance already contains
-- historical rows.
-- ---------------------------------------------------------

ALTER TABLE "public"."Attendance"
ADD COLUMN "designationId" INTEGER;


-- ---------------------------------------------------------
-- 2. BACKFILL HISTORICAL ATTENDANCE DESIGNATION
--
-- Historical attendance did not record the designation under
-- which the employee actually worked, so Employee.designationId
-- is the safest historical fallback.
-- ---------------------------------------------------------

UPDATE "public"."Attendance" AS a
SET "designationId" = e."designationId"
FROM "public"."Employee" AS e
WHERE e."id" = a."employeeId";


-- Safety check: migration must not continue if any historical
-- Attendance row could not receive a designation.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "public"."Attendance"
        WHERE "designationId" IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot migrate Attendance: designationId backfill contains NULL values';
    END IF;
END
$$;


-- Daily Attendance requires worked designation going forward.
ALTER TABLE "public"."Attendance"
ALTER COLUMN "designationId" SET NOT NULL;


-- ---------------------------------------------------------
-- 3. CREATE DAILY OT ATTENDANCE TABLE
-- ---------------------------------------------------------

CREATE TABLE "public"."OtAttendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "designationId" INTEGER NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "shift" "public"."AttendanceShift" NOT NULL,
    "otHours" DECIMAL(5,2) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtAttendance_pkey" PRIMARY KEY ("id")
);


-- ---------------------------------------------------------
-- 4. MIGRATE EXISTING MANUAL OT
--
-- Only positive OT values become Daily OT Attendance records.
--
-- Historical OT designation uses Employee.designationId because
-- the old Attendance model had no worked-designation field.
--
-- Department/date/shift/remarks are preserved.
-- ---------------------------------------------------------

INSERT INTO "public"."OtAttendance" (
    "employeeId",
    "departmentId",
    "designationId",
    "attendanceDate",
    "shift",
    "otHours",
    "remarks",
    "createdAt",
    "updatedAt"
)
SELECT
    a."employeeId",
    a."departmentId",
    e."designationId",
    a."attendanceDate",
    a."shift",
    a."otHours",
    a."remarks",
    a."createdAt",
    a."updatedAt"
FROM "public"."Attendance" AS a
INNER JOIN "public"."Employee" AS e
    ON e."id" = a."employeeId"
WHERE a."otHours" > 0;


-- ---------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------

CREATE INDEX "OtAttendance_departmentId_idx"
ON "public"."OtAttendance"("departmentId");

CREATE INDEX "OtAttendance_designationId_idx"
ON "public"."OtAttendance"("designationId");

CREATE INDEX "OtAttendance_attendanceDate_idx"
ON "public"."OtAttendance"("attendanceDate");

CREATE UNIQUE INDEX "OtAttendance_employeeId_attendanceDate_shift_key"
ON "public"."OtAttendance"(
    "employeeId",
    "attendanceDate",
    "shift"
);

CREATE INDEX "Attendance_designationId_idx"
ON "public"."Attendance"("designationId");


-- ---------------------------------------------------------
-- 6. FOREIGN KEYS
-- ---------------------------------------------------------

ALTER TABLE "public"."Attendance"
ADD CONSTRAINT "Attendance_designationId_fkey"
FOREIGN KEY ("designationId")
REFERENCES "public"."Designation"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


ALTER TABLE "public"."OtAttendance"
ADD CONSTRAINT "OtAttendance_employeeId_fkey"
FOREIGN KEY ("employeeId")
REFERENCES "public"."Employee"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


ALTER TABLE "public"."OtAttendance"
ADD CONSTRAINT "OtAttendance_departmentId_fkey"
FOREIGN KEY ("departmentId")
REFERENCES "public"."Department"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


ALTER TABLE "public"."OtAttendance"
ADD CONSTRAINT "OtAttendance_designationId_fkey"
FOREIGN KEY ("designationId")
REFERENCES "public"."Designation"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
-- Remove obsolete OT storage from Daily Attendance.
-- Manual OT is now stored exclusively in OtAttendance.

ALTER TABLE "public"."Attendance"
DROP COLUMN "otHours";

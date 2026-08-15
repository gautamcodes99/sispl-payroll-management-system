DROP INDEX IF EXISTS "Attendance_employeeId_attendanceDate_key";

CREATE UNIQUE INDEX "Attendance_employeeId_attendanceDate_shift_key"
ON "public"."Attendance" ("employeeId", "attendanceDate", "shift");
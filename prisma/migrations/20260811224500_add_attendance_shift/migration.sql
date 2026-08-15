CREATE TYPE "public"."AttendanceShift" AS ENUM ('FIRST', 'SECOND', 'THIRD');

ALTER TABLE "public"."Attendance"
ADD COLUMN "shift" "public"."AttendanceShift" NOT NULL DEFAULT 'FIRST';

ALTER TABLE "public"."Attendance"
ALTER COLUMN "shift" DROP DEFAULT;
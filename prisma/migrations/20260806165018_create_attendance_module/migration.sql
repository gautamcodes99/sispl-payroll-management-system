/*
  Warnings:

  - Changed the type of `status` on the `Attendance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF');

-- AlterTable
ALTER TABLE "public"."Attendance" DROP COLUMN "status",
ADD COLUMN     "status" "public"."AttendanceStatus" NOT NULL;

-- CreateEnum
CREATE TYPE "public"."HolidayCalendarType" AS ENUM ('WEEK_OFF', 'HOLIDAY');

-- CreateTable
CREATE TABLE "public"."HolidayCalendar" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "public"."HolidayCalendarType" NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendar_date_key" ON "public"."HolidayCalendar"("date");

-- CreateIndex
CREATE INDEX "HolidayCalendar_date_type_idx" ON "public"."HolidayCalendar"("date", "type");

-- AlterTable
ALTER TABLE "public"."Attendance" ADD COLUMN     "departmentId" INTEGER;

-- CreateIndex
CREATE INDEX "Attendance_departmentId_idx" ON "public"."Attendance"("departmentId");

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

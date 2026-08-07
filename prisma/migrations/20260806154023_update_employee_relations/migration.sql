/*
  Warnings:

  - You are about to drop the column `department` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `designation` on the `Employee` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employeeCode]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `designationId` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeCode` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Employee" DROP COLUMN "department",
DROP COLUMN "designation",
ADD COLUMN     "designationId" INTEGER NOT NULL,
ADD COLUMN     "employeeCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "public"."Employee"("employeeCode");

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "public"."Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

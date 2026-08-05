/*
  Warnings:

  - A unique constraint covering the columns `[workTypeId,departmentName]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[siteId,workTypeName]` on the table `WorkType` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Department_workTypeId_departmentName_key" ON "public"."Department"("workTypeId", "departmentName");

-- CreateIndex
CREATE UNIQUE INDEX "WorkType_siteId_workTypeName_key" ON "public"."WorkType"("siteId", "workTypeName");

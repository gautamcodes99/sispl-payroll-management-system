-- CreateTable
CREATE TABLE "public"."Designation" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "designationName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_departmentId_designationName_key" ON "public"."Designation"("departmentId", "designationName");

-- AddForeignKey
ALTER TABLE "public"."Designation" ADD CONSTRAINT "Designation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

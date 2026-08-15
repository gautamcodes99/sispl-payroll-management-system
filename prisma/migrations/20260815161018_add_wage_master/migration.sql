-- CreateEnum
CREATE TYPE "public"."WageMasterOtOption" AS ENUM ('OPTION_A');

-- CreateEnum
CREATE TYPE "public"."WageMasterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "public"."WageMaster" (
    "id" SERIAL NOT NULL,
    "designationId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "basic" DECIMAL(12,2) NOT NULL,
    "da" DECIMAL(12,2) NOT NULL,
    "hraPercentage" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "otOption" "public"."WageMasterOtOption" NOT NULL DEFAULT 'OPTION_A',
    "status" "public"."WageMasterStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WageMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecialAllowanceSlab" (
    "id" SERIAL NOT NULL,
    "wageMasterId" INTEGER NOT NULL,
    "minDays" DECIMAL(5,1) NOT NULL,
    "maxDays" DECIMAL(5,1) NOT NULL,
    "ratePerDay" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialAllowanceSlab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WageMaster_designationId_effectiveFrom_idx" ON "public"."WageMaster"("designationId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "WageMaster_designationId_version_key" ON "public"."WageMaster"("designationId", "version");

-- CreateIndex
CREATE INDEX "SpecialAllowanceSlab_wageMasterId_idx" ON "public"."SpecialAllowanceSlab"("wageMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialAllowanceSlab_wageMasterId_minDays_maxDays_key" ON "public"."SpecialAllowanceSlab"("wageMasterId", "minDays", "maxDays");

-- AddForeignKey
ALTER TABLE "public"."WageMaster" ADD CONSTRAINT "WageMaster_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "public"."Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecialAllowanceSlab" ADD CONSTRAINT "SpecialAllowanceSlab_wageMasterId_fkey" FOREIGN KEY ("wageMasterId") REFERENCES "public"."WageMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

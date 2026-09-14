-- CreateTable
CREATE TABLE "public"."CompanyProfileImage" (
    "id" SERIAL NOT NULL,
    "companyProfileId" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "caption" VARCHAR(150),
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfileImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfileImage_fileName_key" ON "public"."CompanyProfileImage"("fileName");

-- CreateIndex
CREATE INDEX "CompanyProfileImage_companyProfileId_sortOrder_idx" ON "public"."CompanyProfileImage"("companyProfileId", "sortOrder");

-- AddForeignKey
ALTER TABLE "public"."CompanyProfileImage" ADD CONSTRAINT "CompanyProfileImage_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "public"."CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

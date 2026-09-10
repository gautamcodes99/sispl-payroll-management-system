-- CreateTable
CREATE TABLE "public"."CompanyProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL,
    "shortName" TEXT,
    "registeredAddress" TEXT NOT NULL,
    "communicationAddress" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "website" TEXT,
    "pan" TEXT,
    "tan" TEXT,
    "gstin" TEXT,
    "cin" TEXT,
    "pfEstablishmentCode" TEXT,
    "esicEmployerCode" TEXT,
    "ptaxRegistrationNumber" TEXT,
    "mlwfRegistrationNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

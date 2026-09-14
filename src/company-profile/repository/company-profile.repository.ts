import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type SaveCompanyProfileData = {
  companyName: string;
  shortName: string | null;
  registeredAddress: string;
  communicationAddress: string | null;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  cin: string | null;
  pfEstablishmentCode: string | null;
  esicEmployerCode: string | null;
  ptaxRegistrationNumber: string | null;
  mlwfRegistrationNumber: string | null;
  companyHistory: string | null;
  mission: string | null;
  primaryGoals: string | null;
  customers: string | null;
  services: string | null;
};

@Injectable()
export class CompanyProfileRepository {
  private readonly companyProfileId = 1;

  constructor(private readonly prisma: PrismaService) {}

  async find() {
    return this.prisma.companyProfile.findUnique({
      where: {
        id: this.companyProfileId,
      },
    });
  }

  async save(data: SaveCompanyProfileData) {
    return this.prisma.companyProfile.upsert({
      where: {
        id: this.companyProfileId,
      },
      create: {
        id: this.companyProfileId,
        ...data,
      },
      update: data,
    });
  }
}
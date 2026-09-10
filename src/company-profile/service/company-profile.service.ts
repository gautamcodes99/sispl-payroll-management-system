import { BadRequestException, Injectable } from '@nestjs/common';

import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto';
import {
  CompanyProfileRepository,
  SaveCompanyProfileData,
} from '../repository/company-profile.repository';

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly companyProfileRepository: CompanyProfileRepository,
  ) {}

  private optionalString(
    incoming: string | undefined,
    existing: string | null | undefined,
  ): string | null {
    if (incoming === undefined) {
      return existing ?? null;
    }

    const value = incoming.trim();

    return value || null;
  }

  async find() {
    const companyProfile = await this.companyProfileRepository.find();

    if (!companyProfile) {
      return {
        success: true,
        message: 'Company profile has not been configured yet.',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Company profile retrieved successfully.',
      data: companyProfile,
    };
  }

  async update(updateCompanyProfileDto: UpdateCompanyProfileDto) {
    const existing = await this.companyProfileRepository.find();

    let companyName = existing?.companyName;
    let registeredAddress = existing?.registeredAddress;

    if (updateCompanyProfileDto.companyName !== undefined) {
      companyName = updateCompanyProfileDto.companyName.trim();

      if (!companyName) {
        throw new BadRequestException('Company name is required.');
      }
    }

    if (updateCompanyProfileDto.registeredAddress !== undefined) {
      registeredAddress = updateCompanyProfileDto.registeredAddress.trim();

      if (!registeredAddress) {
        throw new BadRequestException('Registered address is required.');
      }
    }

    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }

    if (!registeredAddress) {
      throw new BadRequestException('Registered address is required.');
    }

    const data: SaveCompanyProfileData = {
      companyName,
      shortName: this.optionalString(
        updateCompanyProfileDto.shortName,
        existing?.shortName,
      ),
      registeredAddress,
      communicationAddress: this.optionalString(
        updateCompanyProfileDto.communicationAddress,
        existing?.communicationAddress,
      ),
      phoneNumber: this.optionalString(
        updateCompanyProfileDto.phoneNumber,
        existing?.phoneNumber,
      ),
      email: this.optionalString(
        updateCompanyProfileDto.email,
        existing?.email,
      )?.toLowerCase() ?? null,
      website: this.optionalString(
        updateCompanyProfileDto.website,
        existing?.website,
      ),
      pan: this.optionalString(
        updateCompanyProfileDto.pan,
        existing?.pan,
      ),
      tan: this.optionalString(
        updateCompanyProfileDto.tan,
        existing?.tan,
      ),
      gstin: this.optionalString(
        updateCompanyProfileDto.gstin,
        existing?.gstin,
      ),
      cin: this.optionalString(
        updateCompanyProfileDto.cin,
        existing?.cin,
      ),
      pfEstablishmentCode: this.optionalString(
        updateCompanyProfileDto.pfEstablishmentCode,
        existing?.pfEstablishmentCode,
      ),
      esicEmployerCode: this.optionalString(
        updateCompanyProfileDto.esicEmployerCode,
        existing?.esicEmployerCode,
      ),
      ptaxRegistrationNumber: this.optionalString(
        updateCompanyProfileDto.ptaxRegistrationNumber,
        existing?.ptaxRegistrationNumber,
      ),
      mlwfRegistrationNumber: this.optionalString(
        updateCompanyProfileDto.mlwfRegistrationNumber,
        existing?.mlwfRegistrationNumber,
      ),
    };

    const companyProfile = await this.companyProfileRepository.save(data);

    return {
      success: true,
      message: existing
        ? 'Company profile updated successfully.'
        : 'Company profile configured successfully.',
      data: companyProfile,
    };
  }
}
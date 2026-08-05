import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSiteDto } from '../dto/create-site.dto';
import { OrganisationRepository } from '../repository/organisation.repository';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { UpdateStatusDto } from '../../common/dto/update-status.dto';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
  ) {}

  async createSite(createSiteDto: CreateSiteDto) {
    const site = await this.organisationRepository.createSite(createSiteDto);

    return {
      success: true,
      message: 'Site created successfully.',
      data: site,
    };
  }
  async findSites() {
    const sites = await this.organisationRepository.findSites();

    return {
      success: true,
      message: 'Sites fetched successfully.',
      data: sites,
    };
  }
  async findSiteById(id: number) {
    const site = await this.organisationRepository.findSiteById(id);

    if (!site) {
      throw new NotFoundException('Site not found.');
    }

    return {
      success: true,
      message: 'Site fetched successfully.',
      data: site,
    };
  }
  async updateSite(id: number, updateSiteDto: UpdateSiteDto) {
    await this.findSiteById(id);

    const site = await this.organisationRepository.updateSite(
      id,
      updateSiteDto,
    );

    return {
      success: true,
      message: 'Site updated successfully.',
      data: site,
    };
  }
  async updateSiteStatus(id: number, updateStatusDto: UpdateStatusDto) {
    await this.findSiteById(id);

    const site = await this.organisationRepository.updateSiteStatus(
      id,
      updateStatusDto.status,
    );

    return {
      success: true,
      message: 'Site status updated successfully.',
      data: site,
    };
  }
}

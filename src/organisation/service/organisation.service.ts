import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSiteDto } from '../dto/create-site.dto';
import { OrganisationRepository } from '../repository/organisation.repository';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { UpdateStatusDto } from '../../common/dto/update-status.dto';
import { CreateWorkTypeDto } from '../dto/create-work-type.dto';
import { UpdateWorkTypeDto } from '../dto/update-work-type.dto';
import { UpdateWorkTypeStatusDto } from '../dto/update-work-type-status.dto';

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
  async createWorkType(createWorkTypeDto: CreateWorkTypeDto) {
    // Verify the Site exists
    await this.findSiteById(createWorkTypeDto.siteId);

    const workType =
      await this.organisationRepository.createWorkType(createWorkTypeDto);

    return {
      success: true,
      message: 'Work Type created successfully.',
      data: workType,
    };
  }
  async findWorkTypes() {
    const workTypes = await this.organisationRepository.findWorkTypes();

    return {
      success: true,
      message: 'Work Types fetched successfully.',
      data: workTypes,
    };
  }
  async findWorkTypeById(id: number) {
    const workType = await this.organisationRepository.findWorkTypeById(id);

    return {
      success: true,
      message: 'Work Type fetched successfully.',
      data: workType,
    };
  }
  async updateWorkType(id: number, updateWorkTypeDto: UpdateWorkTypeDto) {
    // Verify Work Type exists
    await this.organisationRepository.findWorkTypeById(id);

    // Verify Site exists (only if siteId is being changed)
    if (updateWorkTypeDto.siteId) {
      await this.findSiteById(updateWorkTypeDto.siteId);
    }

    const workType = await this.organisationRepository.updateWorkType(
      id,
      updateWorkTypeDto,
    );

    return {
      success: true,
      message: 'Work Type updated successfully.',
      data: workType,
    };
  }
  async updateWorkTypeStatus(
    id: number,
    updateWorkTypeStatusDto: UpdateWorkTypeStatusDto,
  ) {
    // Verify Work Type exists
    await this.organisationRepository.findWorkTypeById(id);

    const workType = await this.organisationRepository.updateWorkTypeStatus(
      id,
      updateWorkTypeStatusDto,
    );

    return {
      success: true,
      message: 'Work Type status updated successfully.',
      data: workType,
    };
  }
}

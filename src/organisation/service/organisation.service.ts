import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSiteDto } from '../dto/create-site.dto';
import { OrganisationRepository } from '../repository/organisation.repository';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { UpdateStatusDto } from '../../common/dto/update-status.dto';
import { CreateWorkTypeDto } from '../dto/create-work-type.dto';
import { UpdateWorkTypeDto } from '../dto/update-work-type.dto';
import { UpdateWorkTypeStatusDto } from '../dto/update-work-type-status.dto';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { UpdateDepartmentStatusDto } from '../dto/update-department-status.dto';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { UpdateDesignationDto } from '../dto/update-designation.dto';
import { UpdateDesignationStatusDto } from '../dto/update-designation-status.dto';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
  ) {}

  // =========================================================
  // SITE
  // =========================================================

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

  // =========================================================
  // WORK TYPE
  // =========================================================

  async createWorkType(createWorkTypeDto: CreateWorkTypeDto) {
    // Verify Site exists
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

    // Verify Site exists if Site is being changed
    if (updateWorkTypeDto.siteId !== undefined) {
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

  // =========================================================
  // DEPARTMENT
  // =========================================================

  async createDepartment(createDepartmentDto: CreateDepartmentDto) {
    // Verify Work Type exists
    await this.findWorkTypeById(createDepartmentDto.workTypeId);

    const department =
      await this.organisationRepository.createDepartment(createDepartmentDto);

    return {
      success: true,
      message: 'Department created successfully.',
      data: department,
    };
  }

  async findDepartments() {
    const departments = await this.organisationRepository.findDepartments();

    return {
      success: true,
      message: 'Departments fetched successfully.',
      data: departments,
    };
  }

  async findDepartmentById(id: number) {
    const department = await this.organisationRepository.findDepartmentById(id);

    return {
      success: true,
      message: 'Department fetched successfully.',
      data: department,
    };
  }

  async updateDepartment(id: number, updateDepartmentDto: UpdateDepartmentDto) {
    // Verify Department exists
    await this.organisationRepository.findDepartmentById(id);

    // Verify Work Type exists if Work Type is being changed
    if (updateDepartmentDto.workTypeId !== undefined) {
      await this.findWorkTypeById(updateDepartmentDto.workTypeId);
    }

    const department = await this.organisationRepository.updateDepartment(
      id,
      updateDepartmentDto,
    );

    return {
      success: true,
      message: 'Department updated successfully.',
      data: department,
    };
  }

  async updateDepartmentStatus(
    id: number,
    updateDepartmentStatusDto: UpdateDepartmentStatusDto,
  ) {
    // Verify Department exists
    await this.organisationRepository.findDepartmentById(id);

    const department = await this.organisationRepository.updateDepartmentStatus(
      id,
      updateDepartmentStatusDto,
    );

    return {
      success: true,
      message: 'Department status updated successfully.',
      data: department,
    };
  }

  // =========================================================
  // DESIGNATION
  // =========================================================
  //
  // Designation is a company-wide master.
  //
  // Initial master designations:
  // - Unskilled
  // - Semi Skilled
  // - Skilled
  // - Supervisor
  // - Manager
  //
  // HR may create additional company-wide designations.
  //
  // Designation does NOT belong to Site.
  //
  // Organisation hierarchy remains:
  //
  // Site
  //   -> Work Type
  //      -> Department
  // =========================================================

  async createDesignation(createDesignationDto: CreateDesignationDto) {
    const designation =
      await this.organisationRepository.createDesignation(createDesignationDto);

    return {
      success: true,
      message: 'Designation created successfully.',
      data: designation,
    };
  }

  async findDesignations() {
    const designations = await this.organisationRepository.findDesignations();

    return {
      success: true,
      message: 'Designations fetched successfully.',
      data: designations,
    };
  }

  async findDesignationById(id: number) {
    const designation =
      await this.organisationRepository.findDesignationById(id);

    if (!designation) {
      throw new NotFoundException('Designation not found.');
    }

    return {
      success: true,
      message: 'Designation fetched successfully.',
      data: designation,
    };
  }

  async updateDesignation(
    id: number,
    updateDesignationDto: UpdateDesignationDto,
  ) {
    await this.findDesignationById(id);

    const designation = await this.organisationRepository.updateDesignation(
      id,
      updateDesignationDto,
    );

    return {
      success: true,
      message: 'Designation updated successfully.',
      data: designation,
    };
  }

  async updateDesignationStatus(
    id: number,
    updateDesignationStatusDto: UpdateDesignationStatusDto,
  ) {
    // Verify Designation exists
    await this.findDesignationById(id);

    const designation =
      await this.organisationRepository.updateDesignationStatus(
        id,
        updateDesignationStatusDto,
      );

    return {
      success: true,
      message: 'Designation status updated successfully.',
      data: designation,
    };
  }
}

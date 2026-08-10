import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSiteDto } from '../dto/create-site.dto';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { Status } from '../../common/enums/status.enum';
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
export class OrganisationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // SITE
  // =========================================================

  async createSite(createSiteDto: CreateSiteDto) {
    const site = await this.prisma.site.create({
      data: createSiteDto,
    });

    return site;
  }

  async findSites() {
    return this.prisma.site.findMany({
      orderBy: {
        siteName: 'asc',
      },
    });
  }

  async findSiteById(id: number) {
    return this.prisma.site.findUnique({
      where: {
        id,
      },
    });
  }

  async updateSite(id: number, updateSiteDto: UpdateSiteDto) {
    return this.prisma.site.update({
      where: {
        id,
      },
      data: updateSiteDto,
    });
  }

  async updateSiteStatus(id: number, status: Status) {
    return this.prisma.site.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }

  // =========================================================
  // WORK TYPE
  // =========================================================

  async createWorkType(createWorkTypeDto: CreateWorkTypeDto) {
    return this.prisma.workType.create({
      data: createWorkTypeDto,
    });
  }

  async findWorkTypes() {
    return this.prisma.workType.findMany({
      include: {
        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
      orderBy: [
        {
          site: {
            siteName: 'asc',
          },
        },
        {
          workTypeName: 'asc',
        },
      ],
    });
  }

  async findWorkTypeById(id: number) {
    return this.prisma.workType.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
    });
  }

  async updateWorkType(id: number, updateWorkTypeDto: UpdateWorkTypeDto) {
    return this.prisma.workType.update({
      where: {
        id,
      },
      data: updateWorkTypeDto,
    });
  }

  async updateWorkTypeStatus(
    id: number,
    updateWorkTypeStatusDto: UpdateWorkTypeStatusDto,
  ) {
    return this.prisma.workType.update({
      where: {
        id,
      },
      data: {
        status: updateWorkTypeStatusDto.status,
      },
    });
  }

  // =========================================================
  // DEPARTMENT
  // =========================================================

  async createDepartment(createDepartmentDto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: createDepartmentDto,
    });
  }

  async findDepartments() {
    return this.prisma.department.findMany({
      include: {
        workType: {
          select: {
            id: true,
            workTypeName: true,
            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          workType: {
            site: {
              siteName: 'asc',
            },
          },
        },
        {
          workType: {
            workTypeName: 'asc',
          },
        },
        {
          departmentName: 'asc',
        },
      ],
    });
  }

  async findDepartmentById(id: number) {
    return this.prisma.department.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        workType: {
          select: {
            id: true,
            workTypeName: true,
            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
    });
  }

  async updateDepartment(id: number, updateDepartmentDto: UpdateDepartmentDto) {
    return this.prisma.department.update({
      where: {
        id,
      },
      data: updateDepartmentDto,
    });
  }

  async updateDepartmentStatus(
    id: number,
    updateDepartmentStatusDto: UpdateDepartmentStatusDto,
  ) {
    return this.prisma.department.update({
      where: {
        id,
      },
      data: {
        status: updateDepartmentStatusDto.status,
      },
    });
  }

  // =========================================================
  // DESIGNATION
  // =========================================================
  //
  // Designation is a master record under Site.
  //
  // Initial master designations:
  // - Unskilled
  // - Semi Skilled
  // - Skilled
  // - Supervisor
  // - Manager
  //
  // A Site can have its own designation records.
  // =========================================================

  async createDesignation(createDesignationDto: CreateDesignationDto) {
    return this.prisma.designation.create({
      data: createDesignationDto,
    });
  }

  async findDesignations() {
    return this.prisma.designation.findMany({
      include: {
        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
      orderBy: [
        {
          site: {
            siteName: 'asc',
          },
        },
        {
          designationName: 'asc',
        },
      ],
    });
  }

  async findDesignationById(id: number) {
    return this.prisma.designation.findUnique({
      where: {
        id,
      },
      include: {
        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
    });
  }

  async updateDesignation(
    id: number,
    updateDesignationDto: UpdateDesignationDto,
  ) {
    return this.prisma.designation.update({
      where: {
        id,
      },
      data: updateDesignationDto,
      include: {
        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
    });
  }

  async updateDesignationStatus(
    id: number,
    updateDesignationStatusDto: UpdateDesignationStatusDto,
  ) {
    return this.prisma.designation.update({
      where: {
        id,
      },
      data: {
        status: updateDesignationStatusDto.status,
      },
    });
  }
}

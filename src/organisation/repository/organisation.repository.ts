import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSiteDto } from '../dto/create-site.dto';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { Status } from '../../common/enums/status.enum';
import { CreateWorkTypeDto } from '../dto/create-work-type.dto';

@Injectable()
export class OrganisationRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  async createWorkType(createWorkTypeDto: CreateWorkTypeDto) {
    return this.prisma.workType.create({
      data: createWorkTypeDto,
    });
  }
}

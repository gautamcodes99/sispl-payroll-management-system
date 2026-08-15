import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateWageMasterDto } from '../dto/update-wage-master.dto';

@Injectable()
export class WageMasterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.wageMaster.findUnique({
      where: { id },
      include: {
        designation: {
          include: {
            site: true,
          },
        },
        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },
    });
  }

  async findByDesignationId(designationId: number) {
    return this.prisma.wageMaster.findMany({
      where: {
        designationId,
      },
      include: {
        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },
      orderBy: {
        version: 'desc',
      },
    });
  }

  async findByDesignationAndVersion(designationId: number, version: number) {
    return this.prisma.wageMaster.findUnique({
      where: {
        designationId_version: {
          designationId,
          version,
        },
      },
    });
  }

  async create(data: Prisma.WageMasterCreateInput) {
    return this.prisma.wageMaster.create({
      data,
      include: {
        designation: {
          include: {
            site: true,
          },
        },
        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },
    });
  }
  async findDesignationById(id: number) {
    return this.prisma.designation.findUnique({
      where: { id },
      include: {
        site: true,
      },
    });
  }

  async activate(id: number, designationId: number, effectiveFrom: Date) {
    return this.prisma.$transaction(async (tx) => {
      const previousActive = await tx.wageMaster.findFirst({
        where: {
          designationId,
          status: 'ACTIVE',
          id: {
            not: id,
          },
        },
        orderBy: {
          effectiveFrom: 'desc',
        },
      });

      if (previousActive) {
        const previousEffectiveTo = new Date(effectiveFrom);
        previousEffectiveTo.setUTCDate(previousEffectiveTo.getUTCDate() - 1);

        await tx.wageMaster.update({
          where: {
            id: previousActive.id,
          },
          data: {
            effectiveTo: previousEffectiveTo,
            status: 'SUPERSEDED',
          },
        });
      }

      return tx.wageMaster.update({
        where: {
          id,
        },
        data: {
          status: 'ACTIVE',
          effectiveTo: null,
        },
        include: {
          designation: {
            include: {
              site: true,
            },
          },
          specialAllowances: {
            orderBy: {
              minDays: 'asc',
            },
          },
        },
      });
    });
  }
  async findActiveByDesignationId(designationId: number) {
    return this.prisma.wageMaster.findFirst({
      where: {
        designationId,
        status: 'ACTIVE',
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }
  async findAll() {
    return this.prisma.wageMaster.findMany({
      orderBy: [
        {
          designationId: 'asc',
        },
        {
          version: 'desc',
        },
      ],
      include: {
        designation: {
          include: {
            site: true,
          },
        },
        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },
    });
  }
  async findOne(id: number) {
    return this.prisma.wageMaster.findUnique({
      where: {
        id,
      },
      include: {
        designation: {
          include: {
            site: true,
          },
        },
        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },
    });
  }
  async update(id: number, dto: UpdateWageMasterDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.wageMaster.update({
        where: {
          id,
        },
        data: {
          ...(dto.effectiveFrom !== undefined && {
            effectiveFrom: new Date(dto.effectiveFrom),
          }),
          ...(dto.effectiveTo !== undefined && {
            effectiveTo: new Date(dto.effectiveTo),
          }),
          ...(dto.basic !== undefined && {
            basic: dto.basic,
          }),
          ...(dto.da !== undefined && {
            da: dto.da,
          }),
          ...(dto.hraPercentage !== undefined && {
            hraPercentage: dto.hraPercentage,
          }),
          ...(dto.otOption !== undefined && {
            otOption: dto.otOption,
          }),
        },
      });

      if (dto.specialAllowanceSlabs !== undefined) {
        await tx.specialAllowanceSlab.deleteMany({
          where: {
            wageMasterId: id,
          },
        });

        if (dto.specialAllowanceSlabs.length > 0) {
          await tx.specialAllowanceSlab.createMany({
            data: dto.specialAllowanceSlabs.map((slab) => ({
              wageMasterId: id,
              minDays: slab.minDays,
              maxDays: slab.maxDays,
              ratePerDay: slab.ratePerDay,
            })),
          });
        }
      }

      return tx.wageMaster.findUnique({
        where: {
          id,
        },
        include: {
          designation: {
            include: {
              site: true,
            },
          },
          specialAllowances: {
            orderBy: {
              minDays: 'asc',
            },
          },
        },
      });
    });
  }
}

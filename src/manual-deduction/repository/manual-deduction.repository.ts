import { Injectable } from '@nestjs/common';
import { ManualDeduction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManualDeductionRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findFinalizedPayrollRunForMonth(salaryMonth: Date) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: 'FINALIZED',
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        id: true,
        version: true,
        salaryMonth: true,
        status: true,
      },
    });
  }

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
    });
  }

  async findByEmployeeAndMonth(
    employeeId: number,
    salaryMonth: Date,
  ): Promise<ManualDeduction | null> {
    return this.prisma.manualDeduction.findUnique({
      where: {
        employeeId_salaryMonth: {
          employeeId,
          salaryMonth,
        },
      },
    });
  }

  async create(
    data: Prisma.ManualDeductionCreateInput,
  ): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.create({
      data,
      include: {
        employee: {
          include: {
            designation: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(employeeId?: number, salaryMonth?: Date) {
    return this.prisma.manualDeduction.findMany({
      where: {
        ...(employeeId !== undefined && {
          employeeId,
        }),
        ...(salaryMonth !== undefined && {
          salaryMonth,
        }),
      },
      include: {
        employee: {
          include: {
            designation: {
              include: {
                site: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          salaryMonth: 'desc',
        },
        {
          employeeId: 'asc',
        },
      ],
    });
  }

  async findById(id: number) {
    return this.prisma.manualDeduction.findUnique({
      where: {
        id,
      },
      include: {
        employee: {
          include: {
            designation: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: number,
    data: Prisma.ManualDeductionUpdateInput,
  ): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.update({
      where: {
        id,
      },
      data,
      include: {
        employee: {
          include: {
            designation: {
              include: {
                site: true,
              },
            },
          },
        },
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { ManualDeduction, PayrollRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManualDeductionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
    });
  }

  async findEmployeesByIds(employeeIds: number[]) {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.employee.findMany({
      where: {
        id: {
          in: employeeIds,
        },
      },
      include: {
        designation: true,
      },
      orderBy: {
        id: 'asc',
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

  // =========================================================
  // ADVANCE HISTORY
  // =========================================================

  async findAdvanceHistoryBeforeMonth(employeeId: number, salaryMonth: Date) {
    return this.prisma.manualDeduction.findMany({
      where: {
        employeeId,
        salaryMonth: {
          lt: salaryMonth,
        },
      },
      select: {
        employeeId: true,
        salaryMonth: true,
        newAdvance: true,
        numberOfInstallments: true,
        advanceRecovery: true,
      },
      orderBy: {
        salaryMonth: 'asc',
      },
    });
  }

  async findEmployeeIdsWithAdvanceHistoryBeforeMonth(salaryMonth: Date) {
    return this.prisma.manualDeduction.findMany({
      where: {
        salaryMonth: {
          lt: salaryMonth,
        },
        OR: [
          {
            newAdvance: {
              gt: 0,
            },
          },
          {
            advanceRecovery: {
              gt: 0,
            },
          },
        ],
      },
      select: {
        employeeId: true,
      },
      distinct: ['employeeId'],
    });
  }

  async findAdvanceHistoryForEmployeesBeforeMonth(
    employeeIds: number[],
    salaryMonth: Date,
  ) {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.manualDeduction.findMany({
      where: {
        employeeId: {
          in: employeeIds,
        },
        salaryMonth: {
          lt: salaryMonth,
        },
      },
      select: {
        employeeId: true,
        salaryMonth: true,
        newAdvance: true,
        numberOfInstallments: true,
        advanceRecovery: true,
      },
      orderBy: [
        {
          employeeId: 'asc',
        },
        {
          salaryMonth: 'asc',
        },
      ],
    });
  }

  // =========================================================
  // FINALIZED PAYROLL LOCK
  // =========================================================

  async findFinalizedPayrollRunForMonth(salaryMonth: Date) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: PayrollRunStatus.FINALIZED,
      },
      orderBy: {
        version: 'desc',
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
            designation: true,
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
            designation: true,
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
            designation: true,
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
            designation: true,
          },
        },
      },
    });
  }

  async delete(id: number): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.delete({
      where: {
        id,
      },
    });
  }
}

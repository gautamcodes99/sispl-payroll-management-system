import { Injectable } from '@nestjs/common';
import { PayrollRunStatus, Prisma, VariableAllowance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VariableAllowanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
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

  async findByEmployeeAndMonth(
    employeeId: number,
    salaryMonth: Date,
  ): Promise<VariableAllowance | null> {
    return this.prisma.variableAllowance.findUnique({
      where: {
        employeeId_salaryMonth: {
          employeeId,
          salaryMonth,
        },
      },
    });
  }

  async create(
    data: Prisma.VariableAllowanceCreateInput,
  ): Promise<VariableAllowance> {
    return this.prisma.variableAllowance.create({
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
    return this.prisma.variableAllowance.findMany({
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
    return this.prisma.variableAllowance.findUnique({
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
    data: Prisma.VariableAllowanceUpdateInput,
  ): Promise<VariableAllowance> {
    return this.prisma.variableAllowance.update({
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
}

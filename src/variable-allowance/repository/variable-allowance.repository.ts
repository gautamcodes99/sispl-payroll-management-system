import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  PayrollRunStatus,
  Prisma,
  VariableAllowance,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VariableAllowanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // SITE
  // =========================================================

  async findSiteById(siteId: number) {
    return this.prisma.site.findUnique({
      where: {
        id: siteId,
      },
    });
  }

  // =========================================================
  // EMPLOYEE
  // =========================================================

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      include: {
        designation: true,
      },
    });
  }

  // =========================================================
  // MONTHLY SITE CONTEXT
  //
  // Site is derived from:
  // Attendance -> Department -> Work Type -> Site
  //
  // OT is checked separately because Daily OT has its own
  // Department/Site context.
  // =========================================================

  async findMonthlyAttendanceSiteRows(
    employeeId: number,
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    return this.prisma.attendance.findMany({
      where: {
        employeeId,

        attendanceDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
      },

      select: {
        status: true,
        departmentId: true,

        department: {
          select: {
            workType: {
              select: {
                site: {
                  select: {
                    id: true,
                    siteName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findMonthlyOtAttendanceSiteRows(
    employeeId: number,
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    return this.prisma.otAttendance.findMany({
      where: {
        employeeId,

        attendanceDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
      },

      select: {
        otHours: true,
        departmentId: true,

        department: {
          select: {
            workType: {
              select: {
                site: {
                  select: {
                    id: true,
                    siteName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // =========================================================
  // SITE-WISE PAYROLL-ELIGIBLE EMPLOYEE CANDIDATES
  //
  // Final Site-integrity validation remains in Service.
  // =========================================================

  async findMonthlyPayrollCandidatesForSite(
    siteId: number,
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    const payrollStatuses: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PAID_HOLIDAY,
    ];

    return this.prisma.employee.findMany({
      where: {
        attendances: {
          some: {
            attendanceDate: {
              gte: periodStart,
              lt: periodEndExclusive,
            },

            status: {
              in: payrollStatuses,
            },

            department: {
              is: {
                workType: {
                  is: {
                    siteId,
                  },
                },
              },
            },
          },
        },
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        designationId: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
      },

      orderBy: [
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });
  }

  // =========================================================
  // PAYROLL LOCK
  //
  // New Site-wise FINALIZED runs lock only that Site/month.
  //
  // Legacy finalized runs with siteId NULL remain global
  // locks because historically they represented the whole
  // company payroll for the month.
  // =========================================================

  async findFinalizedPayrollRunForSiteAndMonth(
    siteId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: PayrollRunStatus.FINALIZED,

        OR: [
          {
            siteId,
          },
          {
            siteId: null,
          },
        ],
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // VARIABLE ALLOWANCE
  // =========================================================

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
        site: true,

        employee: {
          include: {
            designation: true,
          },
        },
      },
    });
  }

  async findAll(
    siteId: number,
    employeeId?: number,
    salaryMonth?: Date,
  ) {
    return this.prisma.variableAllowance.findMany({
      where: {
        siteId,

        ...(employeeId !== undefined && {
          employeeId,
        }),

        ...(salaryMonth !== undefined && {
          salaryMonth,
        }),
      },

      include: {
        site: true,

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
        site: true,

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
        site: true,

        employee: {
          include: {
            designation: true,
          },
        },
      },
    });
  }

  async delete(id: number): Promise<VariableAllowance> {
    return this.prisma.variableAllowance.delete({
      where: {
        id,
      },
    });
  }
}
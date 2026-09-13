import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  ManualDeduction,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManualDeductionRepository {
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

  // =========================================================
  // MONTHLY SITE CONTEXT
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
  // MANUAL DEDUCTION
  // =========================================================

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
  //
  // IMPORTANT:
  // Advance history remains employee-based across Sites.
  //
  // If an employee transfers Site, the outstanding advance
  // follows the employee. This preserves the established
  // advance ledger calculation.
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
  //
  // New Site-wise FINALIZED run locks only that Site/month.
  //
  // Legacy FINALIZED run with siteId NULL remains a global
  // month lock for compatibility/safety.
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
  // SITE-WISE CRUD
  // =========================================================

  async create(
    data: Prisma.ManualDeductionCreateInput,
  ): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.create({
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
    return this.prisma.manualDeduction.findMany({
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

  // =========================================================
  // LEGACY INTERNAL LIST
  //
  // Temporary compatibility only for internal Payroll Report
  // calls that have not yet been converted to Site-wise.
  //
  // This is NOT exposed through the Manual Deduction HTTP
  // controller.
  // =========================================================

  async findAllLegacy(employeeId?: number, salaryMonth?: Date) {
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
    return this.prisma.manualDeduction.findUnique({
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
    data: Prisma.ManualDeductionUpdateInput,
  ): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.update({
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

  async delete(id: number): Promise<ManualDeduction> {
    return this.prisma.manualDeduction.delete({
      where: {
        id,
      },
    });
  }
}
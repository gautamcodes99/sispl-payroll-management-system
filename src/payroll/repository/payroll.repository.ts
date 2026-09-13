import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // SITE
  // =========================================================

  async findSiteById(siteId: number) {
    return this.prisma.site.findUnique({
      where: {
        id: siteId,
      },

      select: {
        id: true,
        siteName: true,
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
  // SITE-WISE MONTHLY PAYROLL EMPLOYEES
  //
  // Payroll eligibility remains exactly:
  //
  // PRESENT
  // HALF_DAY
  // PAID_HOLIDAY
  //
  // ABSENT / WEEKLY_OFF / HOLIDAY / LEAVE / no-attendance do
  // not independently qualify an employee.
  //
  // OT also does not independently qualify an employee.
  //
  // Current employee status does not remove an employee who
  // worked during the requested historical salary month.
  // =========================================================

  async findMonthlyPayrollEmployees(
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
      },

      orderBy: {
        id: 'asc',
      },
    });
  }

  // =========================================================
  // APPLICABLE COMPANY-WIDE WAGE MASTER
  //
  // Wage Master calculation/rules remain unchanged.
  // =========================================================

  async findApplicableWageMaster(
    designationId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.wageMaster.findFirst({
      where: {
        designationId,

        effectiveFrom: {
          lte: salaryMonth,
        },

        OR: [
          {
            effectiveTo: null,
          },

          {
            effectiveTo: {
              gte: salaryMonth,
            },
          },
        ],

        status: {
          in: ['ACTIVE', 'SUPERSEDED'],
        },
      },

      include: {
        designation: true,

        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },

      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }

  // =========================================================
  // MONTHLY ATTENDANCE SITE CONTEXT
  //
  // These queries intentionally read ALL monthly rows.
  //
  // They are used only for one-employee-one-Site validation.
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

  // =========================================================
  // MONTHLY OT SITE CONTEXT
  // =========================================================

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
  // SITE-WISE MONTHLY ATTENDANCE
  //
  // Only validated selected-Site rows enter calculation.
  // =========================================================

  async findMonthlyAttendance(
    employeeId: number,
    siteId: number,
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

      select: {
        attendanceDate: true,
        status: true,
        shift: true,
      },

      orderBy: [
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],
    });
  }

  // =========================================================
  // SITE-WISE MONTHLY OT ATTENDANCE
  //
  // OT remains manually entered in Daily OT Attendance.
  // =========================================================

  async findMonthlyOtAttendance(
    employeeId: number,
    siteId: number,
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

      select: {
        attendanceDate: true,
        shift: true,
        otHours: true,
      },

      orderBy: [
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],
    });
  }

  // =========================================================
  // VARIABLE ALLOWANCE
  //
  // Unique key intentionally remains employee + salaryMonth.
  // Site ownership is validated in Service.
  // =========================================================

  async findVariableAllowance(
    employeeId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.variableAllowance.findUnique({
      where: {
        employeeId_salaryMonth: {
          employeeId,
          salaryMonth,
        },
      },
    });
  }

  // =========================================================
  // MANUAL DEDUCTION
  //
  // Unique key intentionally remains employee + salaryMonth.
  // Site ownership is validated in Service.
  // =========================================================

  async findManualDeduction(
    employeeId: number,
    salaryMonth: Date,
  ) {
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
  // SITE-WISE PAYROLL RUN HISTORY
  // =========================================================

  async findPayrollRuns(
    siteId: number,
    salaryMonth?: Date,
  ) {
    return this.prisma.payrollRun.findMany({
      where: {
        siteId,

        ...(salaryMonth !== undefined && {
          salaryMonth,
        }),
      },

      orderBy: [
        {
          salaryMonth: 'desc',
        },
        {
          version: 'desc',
        },
      ],

      include: {
        site: true,

        _count: {
          select: {
            snapshots: true,
          },
        },
      },
    });
  }

  // =========================================================
  // CURRENT SITE-WISE RUN WITH SNAPSHOTS
  // =========================================================

  async findCurrentPayrollRunWithSnapshots(
    siteId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId,
        salaryMonth,

        status: {
          in: [
            PayrollRunStatus.FINALIZED,
            PayrollRunStatus.UNLOCKED,
          ],
        },
      },

      orderBy: {
        version: 'desc',
      },

      include: {
        site: true,

        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // FIND PAYROLL RUN BY ID
  //
  // ID lookup remains valid for both new Site-wise runs and
  // preserved legacy global runs.
  // =========================================================

  async findPayrollRunById(id: number) {
    return this.prisma.payrollRun.findUnique({
      where: {
        id,
      },

      include: {
        site: true,

        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // CURRENT RUN FOR AN EXACT SITE SCOPE
  //
  // siteId may be NULL only when checking preserved legacy
  // company-wide runs during unlock.
  // =========================================================

  async findCurrentPayrollRun(
    siteId: number | null,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId,
        salaryMonth,

        status: {
          in: [
            PayrollRunStatus.FINALIZED,
            PayrollRunStatus.UNLOCKED,
          ],
        },
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // LATEST VERSION FOR SITE + MONTH
  // =========================================================

  async findLatestPayrollRun(
    siteId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId,
        salaryMonth,
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // LEGACY GLOBAL FINALIZED SAFETY LOCK
  //
  // Historical siteId NULL FINALIZED payroll represented the
  // whole company. It therefore remains a global safety lock.
  // =========================================================

  async findLegacyFinalizedPayrollRunForMonth(
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId: null,
        salaryMonth,
        status: PayrollRunStatus.FINALIZED,
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // CREATE SITE-WISE FINALIZED PAYROLL
  // =========================================================

  async createFinalizedPayrollRun(
    siteId: number,
    salaryMonth: Date,
    version: number,
    snapshots: Prisma.PayrollEmployeeSnapshotUncheckedCreateWithoutPayrollRunInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      return tx.payrollRun.create({
        data: {
          site: {
            connect: {
              id: siteId,
            },
          },

          salaryMonth,
          version,

          status: PayrollRunStatus.FINALIZED,
          finalizedAt: new Date(),

          snapshots: {
            create: snapshots,
          },
        },

        include: {
          site: true,

          snapshots: {
            orderBy: {
              employeeId: 'asc',
            },
          },
        },
      });
    });
  }

  // =========================================================
  // UNLOCK PAYROLL
  // =========================================================

  async unlockPayrollRun(id: number) {
    return this.prisma.payrollRun.update({
      where: {
        id,
      },

      data: {
        status: PayrollRunStatus.UNLOCKED,
        unlockedAt: new Date(),
      },

      include: {
        site: true,

        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // REPROCESS SITE-WISE PAYROLL
  //
  // Old UNLOCKED version becomes SUPERSEDED and the new
  // Site/month version is created atomically.
  // =========================================================

  async reprocessPayrollRun(
    oldPayrollRunId: number,
    siteId: number,
    salaryMonth: Date,
    version: number,
    snapshots: Prisma.PayrollEmployeeSnapshotUncheckedCreateWithoutPayrollRunInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: {
          id: oldPayrollRunId,
        },

        data: {
          status: PayrollRunStatus.SUPERSEDED,
        },
      });

      return tx.payrollRun.create({
        data: {
          site: {
            connect: {
              id: siteId,
            },
          },

          salaryMonth,
          version,

          status: PayrollRunStatus.FINALIZED,
          finalizedAt: new Date(),

          snapshots: {
            create: snapshots,
          },
        },

        include: {
          site: true,

          snapshots: {
            orderBy: {
              employeeId: 'asc',
            },
          },
        },
      });
    });
  }
}
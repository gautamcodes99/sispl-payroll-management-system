import { Injectable } from '@nestjs/common';
import { AttendanceStatus, PayrollRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // EMPLOYEE
  // =========================================================

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      include: {
        designation: {
          include: {
            site: true,
          },
        },
      },
    });
  }

  // =========================================================
  // COMPANY-WIDE MONTHLY PAYROLL EMPLOYEES
  //
  // Include:
  //
  // 1. All currently ACTIVE employees.
  //
  // 2. Employees who have payroll-relevant attendance during
  //    the requested wage month even if their current status
  //    is later INACTIVE / RESIGNED / TERMINATED.
  //
  // Payroll-relevant attendance:
  // PRESENT
  // HALF_DAY
  // PAID_HOLIDAY
  // =========================================================

  async findMonthlyPayrollEmployees(
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    const payrollStatuses: AttendanceStatus[] = [
      'PRESENT',
      'HALF_DAY',
      'PAID_HOLIDAY',
    ];

    return this.prisma.employee.findMany({
      where: {
        OR: [
          {
            status: 'ACTIVE',
          },

          {
            attendances: {
              some: {
                attendanceDate: {
                  gte: periodStart,
                  lt: periodEndExclusive,
                },

                status: {
                  in: payrollStatuses,
                },
              },
            },
          },
        ],
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
  // APPLICABLE WAGE MASTER
  // =========================================================

  async findApplicableWageMaster(designationId: number, salaryMonth: Date) {
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

      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }

  // =========================================================
  // MONTHLY ATTENDANCE
  // =========================================================

  async findMonthlyAttendance(
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
        attendanceDate: true,
        status: true,
        shift: true,
        otHours: true,
      },

      orderBy: {
        attendanceDate: 'asc',
      },
    });
  }

  // =========================================================
  // VARIABLE ALLOWANCE
  // =========================================================

  async findVariableAllowance(employeeId: number, salaryMonth: Date) {
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
  // =========================================================

  async findManualDeduction(employeeId: number, salaryMonth: Date) {
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
  // FIND PAYROLL RUN BY ID
  // =========================================================

  async findPayrollRunById(id: number) {
    return this.prisma.payrollRun.findUnique({
      where: {
        id,
      },

      include: {
        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // CURRENT PAYROLL RUN
  //
  // FINALIZED = locked
  // UNLOCKED  = correction/reprocess pending
  // =========================================================

  async findCurrentPayrollRun(salaryMonth: Date) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,

        status: {
          in: [PayrollRunStatus.FINALIZED, PayrollRunStatus.UNLOCKED],
        },
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // LATEST PAYROLL VERSION
  // =========================================================

  async findLatestPayrollRun(salaryMonth: Date) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
      },

      orderBy: {
        version: 'desc',
      },
    });
  }

  // =========================================================
  // FINALIZED PAYROLL FOR MONTH
  //
  // Used later by Attendance lock validation.
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

  // =========================================================
  // CREATE FINALIZED PAYROLL
  //
  // PayrollRun + all employee snapshots are created in one
  // database transaction.
  // =========================================================

  async createFinalizedPayrollRun(
    salaryMonth: Date,
    version: number,
    snapshots: Prisma.PayrollEmployeeSnapshotUncheckedCreateWithoutPayrollRunInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      return tx.payrollRun.create({
        data: {
          salaryMonth,
          version,
          status: PayrollRunStatus.FINALIZED,
          finalizedAt: new Date(),

          snapshots: {
            create: snapshots,
          },
        },

        include: {
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
        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }

  // =========================================================
  // REPROCESS PAYROLL
  //
  // Old UNLOCKED version becomes SUPERSEDED.
  // New version is created as FINALIZED.
  //
  // Both operations happen atomically.
  // =========================================================

  async reprocessPayrollRun(
    oldPayrollRunId: number,
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
          salaryMonth,
          version,
          status: PayrollRunStatus.FINALIZED,
          finalizedAt: new Date(),

          snapshots: {
            create: snapshots,
          },
        },

        include: {
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

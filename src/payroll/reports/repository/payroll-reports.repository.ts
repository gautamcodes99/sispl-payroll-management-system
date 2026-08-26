import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PayrollReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CURRENT PAYROLL RUN FOR REPORTING
  //
  // Reports must use the persisted Payroll Employee Snapshot,
  // not recalculate payroll from current master/attendance data.
  //
  // FINALIZED = normal finalized payroll.
  // UNLOCKED  = current payroll temporarily unlocked for
  //             corrections; its existing snapshot remains the
  //             current reportable snapshot until reprocessed.
  //
  // SUPERSEDED historical versions are not selected here.
  // =========================================================

  async findCurrentPayrollRunWithSnapshots(salaryMonth: Date) {
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

      include: {
        snapshots: {
          where: {
            OR: [
              {
                payableDays: {
                  gt: 0,
                },
              },
              {
                otHours: {
                  gt: 0,
                },
              },
            ],
          },

          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }
  // =========================================================
  // FORM II - MONTHLY ATTENDANCE
  //
  // Form II is a company-wide Payroll Report.
  //
  // Payroll monetary values come from the persisted Payroll
  // Employee Snapshot.
  //
  // This query supplies only the daily Attendance facts needed
  // for the Muster portion of Form II.
  //
  // No Site / Work Type / Department filtering.
  // =========================================================

  async findFormIiMonthlyAttendance(salaryMonth: Date, employeeIds: number[]) {
    if (employeeIds.length === 0) {
      return [];
    }

    const startDate = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth(), 1),
    );

    const endDate = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth() + 1, 1),
    );

    return this.prisma.attendance.findMany({
      where: {
        employeeId: {
          in: employeeIds,
        },

        attendanceDate: {
          gte: startDate,
          lt: endDate,
        },
      },

      orderBy: [
        {
          employeeId: 'asc',
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],

      select: {
        employeeId: true,
        attendanceDate: true,
        status: true,
        shift: true,
        otHours: true,

        employee: {
          select: {
            id: true,
            dateOfBirth: true,
            joiningDate: true,
          },
        },
      },
    });
  }
  // =========================================================
  // FORM II - EMPLOYEE MASTER DETAILS
  //
  // DOB / DOJ must come from Employee Master independently
  // of Attendance.
  //
  // This ensures employees with zero Attendance for the month
  // can still show their available master details in Form II.
  // =========================================================

  async findFormIiEmployeeDetails(employeeIds: number[]) {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.employee.findMany({
      where: {
        id: {
          in: employeeIds,
        },
      },

      orderBy: {
        id: 'asc',
      },

      select: {
        id: true,
        dateOfBirth: true,
        joiningDate: true,
      },
    });
  }
  // =========================================================
  // PAYROLL PAYMENT - SNAPSHOT CONTEXT
  //
  // Payment updates are allowed only for snapshots belonging
  // to the current FINALIZED Payroll Run.
  // =========================================================

  async findPayrollSnapshotPaymentContext(snapshotId: number) {
    return this.prisma.payrollEmployeeSnapshot.findUnique({
      where: {
        id: snapshotId,
      },

      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        netSalary: true,

        payrollRun: {
          select: {
            id: true,
            salaryMonth: true,
            version: true,
            status: true,
          },
        },

        payment: {
          select: {
            id: true,
            status: true,
            paymentDate: true,
            paymentMode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  // =========================================================
  // PAYROLL PAYMENT - BULK SNAPSHOT CONTEXT
  // =========================================================

  async findPayrollSnapshotsPaymentContext(snapshotIds: number[]) {
    if (snapshotIds.length === 0) {
      return [];
    }

    return this.prisma.payrollEmployeeSnapshot.findMany({
      where: {
        id: {
          in: snapshotIds,
        },
      },

      orderBy: {
        id: 'asc',
      },

      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        netSalary: true,

        payrollRun: {
          select: {
            id: true,
            salaryMonth: true,
            version: true,
            status: true,
          },
        },

        payment: {
          select: {
            id: true,
            status: true,
            paymentDate: true,
            paymentMode: true,
          },
        },
      },
    });
  }

  // =========================================================
  // PAYROLL PAYMENT - UPSERT SINGLE
  // =========================================================

  async upsertPayrollPayment(
    snapshotId: number,
    status: 'UNPAID' | 'PAID',
    paymentDate: Date | null,
    paymentMode: 'BANK_TRANSFER' | 'CHEQUE' | null,
  ) {
    return this.prisma.payrollPayment.upsert({
      where: {
        payrollSnapshotId: snapshotId,
      },

      create: {
        payrollSnapshotId: snapshotId,
        status,
        paymentDate,
        paymentMode,
      },

      update: {
        status,
        paymentDate,
        paymentMode,
      },
    });
  }

  // =========================================================
  // PAYROLL PAYMENT - BULK UPSERT
  // =========================================================

  async upsertPayrollPayments(
    snapshotIds: number[],
    status: 'UNPAID' | 'PAID',
    paymentDate: Date | null,
    paymentMode: 'BANK_TRANSFER' | 'CHEQUE' | null,
  ) {
    return this.prisma.$transaction(
      snapshotIds.map((snapshotId) =>
        this.prisma.payrollPayment.upsert({
          where: {
            payrollSnapshotId: snapshotId,
          },

          create: {
            payrollSnapshotId: snapshotId,
            status,
            paymentDate,
            paymentMode,
          },

          update: {
            status,
            paymentDate,
            paymentMode,
          },
        }),
      ),
    );
  }
  // =========================================================
  // SALARY REGISTER / BANK TRANSFER - CURRENT PAYROLL
  //
  // Company-wide Payroll Report source.
  //
  // Uses the current FINALIZED / UNLOCKED Payroll Run and
  // persisted Payroll Employee Snapshots.
  //
  // Payment relation is optional:
  //
  // no payment row = UNPAID
  //
  // Salary values are never recalculated here.
  // =========================================================

  async findCurrentPayrollRunWithSnapshotsAndPayments(salaryMonth: Date) {
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

      include: {
        snapshots: {
          where: {
            OR: [
              {
                payableDays: {
                  gt: 0,
                },
              },
              {
                otHours: {
                  gt: 0,
                },
              },
            ],
          },

          orderBy: {
            employeeId: 'asc',
          },

          include: {
            payment: true,
          },
        },
      },
    });
  }
  // =========================================================
  // PAYSLIP - MONTHLY SITE ATTENDANCE
  //
  // Payslip is company-wide, but each employee's payslip must
  // display the Site(s) where the employee earned the highest
  // payable attendance during the salary month.
  //
  // Payable attendance:
  // PRESENT      = 1
  // HALF_DAY     = 0.5
  // PAID_HOLIDAY = 1
  //
  // Site is derived through:
  // Attendance -> Department -> Work Type -> Site
  //
  // OT hours do not participate in Site selection.
  // =========================================================

  async findPayslipMonthlySiteAttendance(
    salaryMonth: Date,
    employeeIds: number[],
  ) {
    if (employeeIds.length === 0) {
      return [];
    }

    const startDate = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth(), 1),
    );

    const endDate = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth() + 1, 1),
    );

    return this.prisma.attendance.findMany({
      where: {
        employeeId: {
          in: employeeIds,
        },

        attendanceDate: {
          gte: startDate,
          lt: endDate,
        },

        departmentId: {
          not: null,
        },
      },

      orderBy: [
        {
          employeeId: 'asc',
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],

      select: {
        employeeId: true,
        status: true,

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
}

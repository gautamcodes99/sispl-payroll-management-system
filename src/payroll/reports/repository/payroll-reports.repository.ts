import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PayrollReportsRepository {
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

  async findCurrentPayrollRunWithSnapshots(
    salaryMonth: Date,
    siteId?: number | null,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,

        ...(siteId !== undefined && {
          siteId,
        }),

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
            employee: {
              select: {
                joiningDate: true,
              },
            },
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

  async findFormIiMonthlyAttendance(
    salaryMonth: Date,
    employeeIds: number[],
    siteId: number,
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

        department: {
          is: {
            workType: {
              is: {
                siteId,
              },
            },
          },
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
            siteId: true,
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
            siteId: true,
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

  async findCurrentPayrollRunWithSnapshotsAndPayments(
    salaryMonth: Date,
    siteId: number,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId,
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
  // FORM XVI - EMPLOYEE FAMILY DETAILS
  //
  // Used only for the statutory Father's / Husband's Name
  // column.
  //
  // Payroll monetary/designation values continue to come
  // from PayrollEmployeeSnapshot.
  // =========================================================

  async findDeductionReportEmployeeFamilyDetails(employeeIds: number[]) {
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
        gender: true,
        maritalStatus: true,
        fatherName: true,
        husbandName: true,
      },
    });
  }
}

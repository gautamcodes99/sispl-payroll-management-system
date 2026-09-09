import { Injectable } from '@nestjs/common';
import {
  BonusPaymentMode,
  BonusPaymentStatus,
  LeavePaymentMode,
  LeavePaymentStatus,
  PayrollRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class BenefitsReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // BONUS SETTING
  //
  // One common capping amount belongs to one financial year.
  //
  // financialYear stores the starting year:
  // 2025 = FY 2025-2026.
  // =========================================================

  async findBonusSetting(financialYear: number) {
    return this.prisma.bonusSetting.findUnique({
      where: {
        financialYear,
      },
    });
  }

  async upsertBonusSettingAmount(
    financialYear: number,
    cappingAmount: number,
  ) {
    return this.prisma.bonusSetting.upsert({
      where: {
        financialYear,
      },

      create: {
        financialYear,
        cappingAmount,
        isLocked: false,
        lockedAt: null,
      },

      update: {
        cappingAmount,
      },
    });
  }

  async updateBonusSettingLock(
    financialYear: number,
    isLocked: boolean,
    lockedAt: Date | null,
  ) {
    return this.prisma.bonusSetting.update({
      where: {
        financialYear,
      },

      data: {
        isLocked,
        lockedAt,
      },
    });
  }
  // =========================================================
  // LEAVE WORKING SHEET - ANNUAL PAYROLL SNAPSHOTS
  //
  // Source of truth:
  // PayrollEmployeeSnapshot.
  //
  // The report is annual and must use the current reportable
  // Payroll Run for every salary month in the selected year.
  //
  // Current reportable statuses:
  // FINALIZED
  // UNLOCKED
  //
  // SUPERSEDED historical versions are intentionally excluded.
  //
  // IMPORTANT:
  // No payableDays / OT filter is applied here.
  //
  // Employee eligibility for this report is:
  // employee has at least one snapshot belonging to a current
  // reportable Payroll Run in the selected year.
  //
  // Employee Master supplies only fields that are not stored
  // historically in PayrollEmployeeSnapshot:
  // - fatherName
  // - joiningDate
  // - leftDate
  // =========================================================

  async findCurrentReportablePayrollRunsForYear(
    yearStart: Date,
    nextYearStart: Date,
  ) {
    return this.prisma.payrollRun.findMany({
      where: {
        salaryMonth: {
          gte: yearStart,
          lt: nextYearStart,
        },

        status: {
          in: [PayrollRunStatus.FINALIZED, PayrollRunStatus.UNLOCKED],
        },
      },

      orderBy: [
        {
          salaryMonth: 'asc',
        },
        {
          version: 'desc',
        },
      ],

      select: {
        id: true,
        salaryMonth: true,
        version: true,
        status: true,
        finalizedAt: true,
        unlockedAt: true,

        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },

          select: {
            id: true,
            employeeId: true,

            employeeName: true,
            gender: true,
            designationName: true,

            bankName: true,
            bankBranch: true,
            accountNumber: true,
            ifscCode: true,

            presentDays: true,
            halfDays: true,
            paidHolidays: true,
            payableDays: true,

            monthlyBasic: true,
            monthlyDa: true,
            wages: true,

            employee: {
              select: {
                fatherName: true,
                joiningDate: true,
                leftDate: true,
              },
            },
          },
        },
      },
    });
  }

  // =========================================================
  // BONUS PAYMENT
  //
  // Annual payment state belongs to:
  // Employee + Financial Year.
  //
  // Absence of a BonusPayment record is treated by the
  // Service layer as UNPAID.
  //
  // Form-C reads this shared payment source.
  // The Bonus Bank Transfer workflow will update it later.
  // =========================================================

  async findBonusPaymentsForFinancialYear(
    financialYear: number,
    employeeIds: number[],
  ) {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.bonusPayment.findMany({
      where: {
        financialYear,
        employeeId: {
          in: employeeIds,
        },
      },

      orderBy: {
        employeeId: 'asc',
      },

      select: {
        id: true,
        employeeId: true,
        financialYear: true,
        status: true,
        paymentDate: true,
        paymentMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async upsertBonusPayments(params: {
    financialYear: number;
    employeeIds: number[];
    status: BonusPaymentStatus;
    paymentDate: Date | null;
    paymentMode: BonusPaymentMode | null;
  }) {
    const {
      financialYear,
      employeeIds,
      status,
      paymentDate,
      paymentMode,
    } = params;

    return this.prisma.$transaction(
      employeeIds.map((employeeId) =>
        this.prisma.bonusPayment.upsert({
          where: {
            employeeId_financialYear: {
              employeeId,
              financialYear,
            },
          },

          create: {
            employeeId,
            financialYear,
            status,
            paymentDate,
            paymentMode,
          },

          update: {
            status,
            paymentDate,
            paymentMode,
          },

          select: {
            id: true,
            employeeId: true,
            financialYear: true,
            status: true,
            paymentDate: true,
            paymentMode: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ),
    );
  }
  // =========================================================
  // LEAVE PAYMENT
  //
  // Annual payment state belongs to:
  // Employee + Leave Year.
  //
  // Absence of a LeavePayment record is treated by the
  // Service layer as UNPAID.
  // =========================================================
  async findLeavePaymentsForYear(leaveYear: number, employeeIds: number[]) {
    if (employeeIds.length === 0) {
      return [];
    }

    return this.prisma.leavePayment.findMany({
      where: {
        leaveYear,
        employeeId: {
          in: employeeIds,
        },
      },

      orderBy: {
        employeeId: 'asc',
      },

      select: {
        id: true,
        employeeId: true,
        leaveYear: true,
        status: true,
        paymentDate: true,
        paymentMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertLeavePayments(params: {
    leaveYear: number;
    employeeIds: number[];
    status: LeavePaymentStatus;
    paymentDate: Date | null;
    paymentMode: LeavePaymentMode | null;
  }) {
    const { leaveYear, employeeIds, status, paymentDate, paymentMode } = params;

    return this.prisma.$transaction(
      employeeIds.map((employeeId) =>
        this.prisma.leavePayment.upsert({
          where: {
            employeeId_leaveYear: {
              employeeId,
              leaveYear,
            },
          },

          create: {
            employeeId,
            leaveYear,
            status,
            paymentDate,
            paymentMode,
          },

          update: {
            status,
            paymentDate,
            paymentMode,
          },

          select: {
            id: true,
            employeeId: true,
            leaveYear: true,
            status: true,
            paymentDate: true,
            paymentMode: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ),
    );
  }

  // =========================================================
  // FULL AND FINAL SETTLEMENT
  //
  // Employee.leftDate is the authoritative F&F eligibility
  // and Date of Leaving source.
  //
  // Historical payroll values come only from current
  // reportable Payroll Runs:
  // FINALIZED / UNLOCKED.
  //
  // SUPERSEDED payroll versions are intentionally excluded.
  //
  // FnFSettlement stores only the two HR-entered deductions.
  // All other F&F values remain derived.
  // =========================================================

  async findFnFEmployeesByLeavingMonth(
    monthStart: Date,
    nextMonthStart: Date,
  ) {
    return this.prisma.employee.findMany({
      where: {
        leftDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        joiningDate: true,
        leftDate: true,
        status: true,
      },

      orderBy: [
        { leftDate: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  async findFnFEmployee(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        joiningDate: true,
        leftDate: true,
      },
    });
  }

  async findFnFLeavingMonthSnapshots(
    employeeId: number,
    leavingMonthStart: Date,
    nextMonthStart: Date,
  ) {
    return this.prisma.payrollEmployeeSnapshot.findMany({
      where: {
        employeeId,

        payrollRun: {
          salaryMonth: {
            gte: leavingMonthStart,
            lt: nextMonthStart,
          },

          status: {
            in: [
              PayrollRunStatus.FINALIZED,
              PayrollRunStatus.UNLOCKED,
            ],
          },
        },
      },

      orderBy: [
        {
          payrollRun: {
            version: 'desc',
          },
        },
      ],

      select: {
        id: true,
        employeeId: true,

        employeeName: true,
        designationName: true,

        bankName: true,
        bankBranch: true,
        accountNumber: true,
        ifscCode: true,
        uanNumber: true,
        esicNumber: true,

        monthlyBasic: true,
        monthlyDa: true,
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
            status: true,
            paymentDate: true,
            paymentMode: true,
          },
        },
      },
    });
  }

  async findFnFHistoricalSnapshotsThroughMonth(
    employeeId: number,
    nextMonthStart: Date,
  ) {
    return this.prisma.payrollEmployeeSnapshot.findMany({
      where: {
        employeeId,

        payrollRun: {
          salaryMonth: {
            lt: nextMonthStart,
          },

          status: {
            in: [
              PayrollRunStatus.FINALIZED,
              PayrollRunStatus.UNLOCKED,
            ],
          },
        },
      },

      orderBy: [
        {
          payrollRun: {
            salaryMonth: 'desc',
          },
        },
        {
          payrollRun: {
            version: 'desc',
          },
        },
      ],

      select: {
        id: true,
        employeeId: true,

        employeeName: true,
        designationName: true,

        bankName: true,
        bankBranch: true,
        accountNumber: true,
        ifscCode: true,
        uanNumber: true,
        esicNumber: true,

        monthlyBasic: true,
        monthlyDa: true,

        payrollRun: {
          select: {
            id: true,
            salaryMonth: true,
            version: true,
            status: true,
          },
        },
      },
    });
  }

  async findFnFLeavePayment(employeeId: number, leaveYear: number) {
    return this.prisma.leavePayment.findUnique({
      where: {
        employeeId_leaveYear: {
          employeeId,
          leaveYear,
        },
      },

      select: {
        employeeId: true,
        leaveYear: true,
        status: true,
        paymentDate: true,
        paymentMode: true,
      },
    });
  }

  async findFnFBonusPayment(
    employeeId: number,
    financialYear: number,
  ) {
    return this.prisma.bonusPayment.findUnique({
      where: {
        employeeId_financialYear: {
          employeeId,
          financialYear,
        },
      },

      select: {
        employeeId: true,
        financialYear: true,
        status: true,
        paymentDate: true,
        paymentMode: true,
      },
    });
  }

  async findFnFAdvanceHistoryThroughMonth(
    employeeId: number,
    nextMonthStart: Date,
  ) {
    return this.prisma.manualDeduction.findMany({
      where: {
        employeeId,

        salaryMonth: {
          lt: nextMonthStart,
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

  async findFnFSettlement(employeeId: number) {
    return this.prisma.fnFSettlement.findUnique({
      where: {
        employeeId,
      },
    });
  }

  async upsertFnFSettlement(params: {
    employeeId: number;
    uniformShoesRecovery: number;
    otherPermissibleDeduction: number;
  }) {
    const {
      employeeId,
      uniformShoesRecovery,
      otherPermissibleDeduction,
    } = params;

    return this.prisma.fnFSettlement.upsert({
      where: {
        employeeId,
      },

      create: {
        employeeId,
        uniformShoesRecovery,
        otherPermissibleDeduction,
      },

      update: {
        uniformShoesRecovery,
        otherPermissibleDeduction,
      },
    });
  }
}

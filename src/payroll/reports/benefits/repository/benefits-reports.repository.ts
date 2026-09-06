import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class BenefitsReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
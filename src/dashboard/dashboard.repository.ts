import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  private readonly companyProfileId = 1;

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // EMPLOYEE OVERVIEW
  // =========================================================

  async countEmployees() {
    return this.prisma.employee.count();
  }

  async countActiveEmployees() {
    return this.prisma.employee.count({
      where: {
        status: 'ACTIVE',
      },
    });
  }

  async countNewJoiners(
    salaryMonth: Date,
    nextSalaryMonth: Date,
  ) {
    return this.prisma.employee.count({
      where: {
        joiningDate: {
          gte: salaryMonth,
          lt: nextSalaryMonth,
        },
      },
    });
  }

  // =========================================================
  // ATTENDANCE SUMMARY
  //
  // Dashboard counts EMPLOYEES, not attendance rows.
  //
  // This avoids inflated counts if an employee has more than
  // one attendance record on the same date.
  //
  // Existing behavior is intentionally preserved.
  // =========================================================

  async getAttendanceSummary(
    date: Date,
    nextDate: Date,
  ) {
    const attendanceRows =
      await this.prisma.attendance.findMany({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },
        },

        select: {
          employeeId: true,
          status: true,
        },
      });

    const employeeStatus = new Map<number, string>();

    for (const attendance of attendanceRows) {
      if (!employeeStatus.has(attendance.employeeId)) {
        employeeStatus.set(
          attendance.employeeId,
          attendance.status,
        );
      }
    }

    const summary = {
      present: 0,
      absent: 0,
      leave: 0,
      holiday: 0,
      weeklyOff: 0,
      halfDay: 0,
      paidHoliday: 0,
    };

    for (const status of employeeStatus.values()) {
      switch (status) {
        case 'PRESENT':
          summary.present += 1;
          break;

        case 'ABSENT':
          summary.absent += 1;
          break;

        case 'LEAVE':
          summary.leave += 1;
          break;

        case 'HOLIDAY':
          summary.holiday += 1;
          break;

        case 'WEEKLY_OFF':
          summary.weeklyOff += 1;
          break;

        case 'HALF_DAY':
          summary.halfDay += 1;
          break;

        case 'PAID_HOLIDAY':
          summary.paidHoliday += 1;
          break;
      }
    }

    return {
      ...summary,
      markedEmployeeIds: [...employeeStatus.keys()],
    };
  }

  // =========================================================
  // PENDING ATTENDANCE
  // =========================================================

  async countPendingActiveEmployees(
    markedEmployeeIds: number[],
  ) {
    return this.prisma.employee.count({
      where: {
        status: 'ACTIVE',

        ...(markedEmployeeIds.length > 0 && {
          id: {
            notIn: markedEmployeeIds,
          },
        }),
      },
    });
  }

  // =========================================================
  // EXISTING CURRENT PAYROLL RUN
  //
  // Kept for backward compatibility with the existing
  // dashboard response.
  //
  // The redesigned Dashboard will use the separate
  // company-wide currentPayroll summary below.
  // =========================================================

  async findCurrentPayrollRunSummary(
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
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

      select: {
        id: true,
        salaryMonth: true,
        version: true,
        status: true,
        finalizedAt: true,
        unlockedAt: true,

        _count: {
          select: {
            snapshots: true,
          },
        },

        snapshots: {
          select: {
            gross: true,
            pf: true,
            esic: true,
            ptax: true,
            mlwf: true,
            totalDeductions: true,
            netSalary: true,
          },
        },
      },
    });
  }

  // =========================================================
  // COMPANY-WIDE CURRENT PAYROLL
  //
  // Payroll is Site-wise.
  //
  // Return all relevant Site runs for the selected salary
  // month. Service chooses the latest relevant version for
  // each Site and aggregates those runs company-wide.
  // =========================================================

  async findCompanyPayrollRunSummaries(
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findMany({
      where: {
        salaryMonth,

        status: {
          in: [
            PayrollRunStatus.FINALIZED,
            PayrollRunStatus.UNLOCKED,
          ],
        },
      },

      orderBy: [
        {
          siteId: 'asc',
        },
        {
          version: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      select: {
        id: true,
        siteId: true,
        salaryMonth: true,
        version: true,
        status: true,
        finalizedAt: true,
        unlockedAt: true,

        _count: {
          select: {
            snapshots: true,
          },
        },

        snapshots: {
          select: {
            gross: true,
            pf: true,
            esic: true,
            ptax: true,
            mlwf: true,
            totalDeductions: true,
            netSalary: true,
          },
        },
      },
    });
  }

  // =========================================================
  // COMPANY DETAILS + ACTIVE GALLERY
  //
  // Dashboard is read-only.
  // Only ACTIVE gallery images are returned.
  // =========================================================

  async findCompanyDashboardDetails() {
    return this.prisma.companyProfile.findUnique({
      where: {
        id: this.companyProfileId,
      },

      select: {
        companyName: true,
        registeredAddress: true,

        pan: true,
        gstin: true,
        pfEstablishmentCode: true,
        esicEmployerCode: true,
        ptaxRegistrationNumber: true,
        mlwfRegistrationNumber: true,

        companyHistory: true,
        mission: true,
        primaryGoals: true,
        customers: true,
        services: true,

        galleryImages: {
          where: {
            isActive: true,
          },

          orderBy: [
            {
              sortOrder: 'asc',
            },
            {
              id: 'asc',
            },
          ],

          select: {
            id: true,
            fileName: true,
            caption: true,
            sortOrder: true,
          },
        },
      },
    });
  }
}

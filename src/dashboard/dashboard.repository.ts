import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // ACTIVE EMPLOYEES
  // =========================================================

  async countActiveEmployees() {
    return this.prisma.employee.count({
      where: {
        status: 'ACTIVE',
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
  // =========================================================

  async getAttendanceSummary(date: Date, nextDate: Date) {
    const attendanceRows = await this.prisma.attendance.findMany({
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
        employeeStatus.set(attendance.employeeId, attendance.status);
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

  async countPendingActiveEmployees(markedEmployeeIds: number[]) {
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
  // CURRENT PAYROLL RUN
  //
  // Dashboard only needs current lifecycle metadata and
  // aggregate snapshot totals.
  //
  // No live payroll recalculation occurs here.
  // =========================================================

  async findCurrentPayrollRunSummary(salaryMonth: Date) {
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
}

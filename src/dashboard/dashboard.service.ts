import { BadRequestException, Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  // =========================================================
  // DATE NORMALIZATION
  // =========================================================

  private normalizeDate(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private normalizeSalaryMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private nextDate(date: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      ),
    );
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  async getDashboard(query: DashboardQueryDto) {
    const inputDate = new Date(query.date);

    if (Number.isNaN(inputDate.getTime())) {
      throw new BadRequestException('Dashboard date is invalid.');
    }

    const date = this.normalizeDate(inputDate);
    const nextDate = this.nextDate(date);
    const salaryMonth = this.normalizeSalaryMonth(date);

    const [activeEmployees, attendanceSummary, payrollRun] = await Promise.all([
      this.dashboardRepository.countActiveEmployees(),

      this.dashboardRepository.getAttendanceSummary(date, nextDate),

      this.dashboardRepository.findCurrentPayrollRunSummary(salaryMonth),
    ]);

    const pending = await this.dashboardRepository.countPendingActiveEmployees(
      attendanceSummary.markedEmployeeIds,
    );

    let payroll: {
      runId: number;
      salaryMonth: Date;
      version: number;
      status: PayrollRunStatus;
      employeeCount: number;
      finalizedAt: Date | null;
      unlockedAt: Date | null;
      gross: number | null;
      pf: number | null;
      esic: number | null;
      ptax: number | null;
      mlwf: number | null;
      totalDeductions: number | null;
      netSalary: number | null;
    } | null = null;

    if (payrollRun) {
      if (payrollRun.status === PayrollRunStatus.FINALIZED) {
        const totals = payrollRun.snapshots.reduce(
          (total, snapshot) => {
            total.gross += Number(snapshot.gross);
            total.pf += Number(snapshot.pf);
            total.esic += Number(snapshot.esic);
            total.ptax += Number(snapshot.ptax);
            total.mlwf += Number(snapshot.mlwf);
            total.totalDeductions += Number(snapshot.totalDeductions);
            total.netSalary += Number(snapshot.netSalary);

            return total;
          },
          {
            gross: 0,
            pf: 0,
            esic: 0,
            ptax: 0,
            mlwf: 0,
            totalDeductions: 0,
            netSalary: 0,
          },
        );

        payroll = {
          runId: payrollRun.id,
          salaryMonth: payrollRun.salaryMonth,
          version: payrollRun.version,
          status: payrollRun.status,
          employeeCount: payrollRun._count.snapshots,
          finalizedAt: payrollRun.finalizedAt,
          unlockedAt: payrollRun.unlockedAt,

          gross: this.money(totals.gross),
          pf: this.money(totals.pf),
          esic: this.money(totals.esic),
          ptax: this.money(totals.ptax),
          mlwf: this.money(totals.mlwf),
          totalDeductions: this.money(totals.totalDeductions),
          netSalary: this.money(totals.netSalary),
        };
      } else {
        payroll = {
          runId: payrollRun.id,
          salaryMonth: payrollRun.salaryMonth,
          version: payrollRun.version,
          status: payrollRun.status,
          employeeCount: payrollRun._count.snapshots,
          finalizedAt: payrollRun.finalizedAt,
          unlockedAt: payrollRun.unlockedAt,

          // Unlocked payroll is under correction.
          // Do not expose historical snapshot totals as if
          // they were the current corrected payroll.
          gross: null,
          pf: null,
          esic: null,
          ptax: null,
          mlwf: null,
          totalDeductions: null,
          netSalary: null,
        };
      }
    }

    return {
      success: true,
      message: 'Dashboard fetched successfully.',

      data: {
        date,
        salaryMonth,

        employees: {
          active: activeEmployees,
        },

        attendance: {
          present: attendanceSummary.present,
          absent: attendanceSummary.absent,
          leave: attendanceSummary.leave,
          holiday: attendanceSummary.holiday,
          weeklyOff: attendanceSummary.weeklyOff,
          halfDay: attendanceSummary.halfDay,
          paidHoliday: attendanceSummary.paidHoliday,
          pending,
        },

        payroll,
      },
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BenefitsReportsRepository } from './repository/benefits-reports.repository';

@Injectable()
export class BenefitsReportsService {
  constructor(
    private readonly benefitsReportsRepository: BenefitsReportsRepository,
  ) {}

  private validateYear(year: number): void {
    if (!Number.isInteger(year) || year < 1900 || year > 9999) {
      throw new BadRequestException('Year is invalid.');
    }
  }

  private number(value: unknown): number {
    return Number(value ?? 0);
  }

  private roundTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private roundValue(value: number): number {
    return Math.round(value);
  }

  private readonly monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ] as const;

  // =========================================================
  // LEAVE WORKING SHEET
  //
  // DAYS =
  // snapshot.payableDays - snapshot.paidHolidays
  //
  // MIN WAGE =
  // (snapshot.monthlyBasic + snapshot.monthlyDa) / 26
  //
  // TOTAL DAYS =
  // Jan-Dec DAYS total
  //
  // Leave Accrued =
  // TOTAL DAYS / 20
  //
  // Leave Encashment For FS =
  // Leave Accrued
  //
  // Total Balance =
  // Leave Accrued - Leave Encashment For FS
  //
  // Average Rate Given By BAL-C =
  // MIN WAGE of the latest month where DAYS > 0
  //
  // TOTAL =
  // full-precision Average Rate * full-precision Leave Encashment
  //
  // ROUND VALUE =
  // ROUND(full-precision TOTAL, 0)
  //
  // STATUS =
  // TOTAL DAYS >= 90 ? QUALIFIED : UNQUALIFIED
  //
  // API/display decimal values are returned to 2 decimal places.
  // Business calculations retain full precision internally.
  // =========================================================

  async getLeaveWorkingSheet(year: number) {
    this.validateYear(year);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

    const payrollRuns =
      await this.benefitsReportsRepository.findCurrentReportablePayrollRunsForYear(
        yearStart,
        nextYearStart,
      );

    if (payrollRuns.length === 0) {
      throw new NotFoundException(
        `No current reportable Payroll Runs found for year ${year}.`,
      );
    }

    const currentRunByMonth = new Map<number, (typeof payrollRuns)[number]>();

    for (const payrollRun of payrollRuns) {
      const monthIndex = payrollRun.salaryMonth.getUTCMonth();

      const existing = currentRunByMonth.get(monthIndex);

      if (!existing || payrollRun.version > existing.version) {
        currentRunByMonth.set(monthIndex, payrollRun);
      }
    }

    const currentRuns = Array.from(currentRunByMonth.values()).sort(
      (a, b) =>
        a.salaryMonth.getTime() - b.salaryMonth.getTime() ||
        b.version - a.version,
    );

    type Snapshot = (typeof currentRuns)[number]['snapshots'][number];

    type EmployeeMonth = {
      month: number;
      monthName: string;
      days: number | null;
      minimumWage: number | null;

      // Internal values retain full precision.
      rawDays: number | null;
      rawMinimumWage: number | null;
    };

    type EmployeeContext = {
      employeeId: number;

      months: EmployeeMonth[];

      latestSnapshot: Snapshot;
      latestSalaryMonth: Date;

      fatherName: string | null;
      joiningDate: Date;
      leftDate: Date | null;
    };

    const employeeMap = new Map<number, EmployeeContext>();

    for (const payrollRun of currentRuns) {
      const monthIndex = payrollRun.salaryMonth.getUTCMonth();

      for (const snapshot of payrollRun.snapshots) {
        const rawDays =
          this.number(snapshot.payableDays) -
          this.number(snapshot.paidHolidays);

        const monthlyBasic = this.number(snapshot.monthlyBasic);
        const monthlyDa = this.number(snapshot.monthlyDa);

        const rawMinimumWage = (monthlyBasic + monthlyDa) / 26;

        let employee = employeeMap.get(snapshot.employeeId);

        if (!employee) {
          employee = {
            employeeId: snapshot.employeeId,

            months: this.monthNames.map((monthName, index) => ({
              month: index + 1,
              monthName,
              days: null,
              minimumWage: null,
              rawDays: null,
              rawMinimumWage: null,
            })),

            latestSnapshot: snapshot,
            latestSalaryMonth: payrollRun.salaryMonth,

            fatherName: snapshot.employee.fatherName,
            joiningDate: snapshot.employee.joiningDate,
            leftDate: snapshot.employee.leftDate,
          };

          employeeMap.set(snapshot.employeeId, employee);
        }

        employee.months[monthIndex] = {
          month: monthIndex + 1,
          monthName: this.monthNames[monthIndex],
          days: this.roundTwo(rawDays),
          minimumWage: this.roundTwo(rawMinimumWage),
          rawDays,
          rawMinimumWage,
        };

        if (
          payrollRun.salaryMonth.getTime() >
          employee.latestSalaryMonth.getTime()
        ) {
          employee.latestSnapshot = snapshot;
          employee.latestSalaryMonth = payrollRun.salaryMonth;
        }

        employee.fatherName = snapshot.employee.fatherName;
        employee.joiningDate = snapshot.employee.joiningDate;
        employee.leftDate = snapshot.employee.leftDate;
      }
    }

    const employeeContexts = Array.from(employeeMap.values()).sort(
      (a, b) => a.employeeId - b.employeeId,
    );

    const employees = employeeContexts.map((employee, index) => {
      const rawTotalDays = employee.months.reduce(
        (total, month) => total + (month.rawDays ?? 0),
        0,
      );

      const rawLeaveAccrued = rawTotalDays / 20;

      const rawLeaveEncashmentForFs = rawLeaveAccrued;

      const rawTotalBalance =
        rawLeaveAccrued - rawLeaveEncashmentForFs;

      // Latest month where the employee actually worked.
      // A snapshot with DAYS = 0 must not become the BAL-C rate source.
      const latestWorkedMonth = [...employee.months]
        .reverse()
        .find(
          (month) =>
            month.rawDays !== null &&
            month.rawDays > 0 &&
            month.rawMinimumWage !== null,
        );

      const rawAverageRateGivenByBalance =
        latestWorkedMonth?.rawMinimumWage ?? null;

      const rawTotal =
        rawAverageRateGivenByBalance === null
          ? 0
          : rawAverageRateGivenByBalance *
            rawLeaveEncashmentForFs;

      const roundValue = this.roundValue(rawTotal);

      const status =
        rawTotalDays >= 90 ? 'QUALIFIED' : 'UNQUALIFIED';

      return {
        serialNumber: index + 1,

        employeeId: employee.employeeId,

        employeeName: employee.latestSnapshot.employeeName,

        fatherName: employee.fatherName,

        gender: employee.latestSnapshot.gender,

        joiningDate: employee.joiningDate,

        designation: employee.latestSnapshot.designationName,

        months: employee.months.map((month) => ({
          month: month.month,
          monthName: month.monthName,
          days: month.days,
          minimumWage: month.minimumWage,
        })),

        totalDays: this.roundTwo(rawTotalDays),

        leaveAccrued: this.roundTwo(rawLeaveAccrued),

        dateOfLeft: employee.leftDate,

        leaveEncashmentForFs: this.roundTwo(
          rawLeaveEncashmentForFs,
        ),

        totalBalance: this.roundTwo(rawTotalBalance),

        averageRateGivenByBalance:
          rawAverageRateGivenByBalance === null
            ? null
            : this.roundTwo(rawAverageRateGivenByBalance),

        total: this.roundTwo(rawTotal),

        roundValue,

        status,

        bankDetails: {
          bankName: employee.latestSnapshot.bankName,
          bankBranch: employee.latestSnapshot.bankBranch,
          ifscCode: employee.latestSnapshot.ifscCode,
          accountNumber: employee.latestSnapshot.accountNumber,
        },

        // Internal precision values are deliberately not exposed.
      };
    });

    const monthlyDays = this.monthNames.map(
      (monthName, monthIndex) => ({
        month: monthIndex + 1,
        monthName,

        days: this.roundTwo(
          employeeContexts.reduce(
            (total, employee) =>
              total +
              (employee.months[monthIndex].rawDays ?? 0),
            0,
          ),
        ),
      }),
    );

    const rawTotals = employeeContexts.reduce(
      (result, employee) => {
        const employeeTotalDays = employee.months.reduce(
          (total, month) => total + (month.rawDays ?? 0),
          0,
        );

        const employeeLeaveAccrued = employeeTotalDays / 20;

        const latestWorkedMonth = [...employee.months]
          .reverse()
          .find(
            (month) =>
              month.rawDays !== null &&
              month.rawDays > 0 &&
              month.rawMinimumWage !== null,
          );

        const employeeRate =
          latestWorkedMonth?.rawMinimumWage ?? null;

        const employeeTotal =
          employeeRate === null
            ? 0
            : employeeRate * employeeLeaveAccrued;

        result.totalDays += employeeTotalDays;
        result.leaveAccrued += employeeLeaveAccrued;
        result.leaveEncashmentForFs += employeeLeaveAccrued;
        result.total += employeeTotal;
        result.roundValue += this.roundValue(employeeTotal);

        return result;
      },
      {
        totalDays: 0,
        leaveAccrued: 0,
        leaveEncashmentForFs: 0,
        total: 0,
        roundValue: 0,
      },
    );

    return {
      success: true,
      message: 'Leave Working Sheet fetched successfully.',

      data: {
        report: {
          type: 'LEAVE_WORKING_SHEET',

          year,

          employeeCount: employees.length,

          payrollRuns: currentRuns.map((payrollRun) => ({
            id: payrollRun.id,
            salaryMonth: payrollRun.salaryMonth,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          })),
        },

        employees,

        totals: {
          monthlyDays,

          totalDays: this.roundTwo(rawTotals.totalDays),

          leaveAccrued: this.roundTwo(
            rawTotals.leaveAccrued,
          ),

          leaveEncashmentForFs: this.roundTwo(
            rawTotals.leaveEncashmentForFs,
          ),

          total: this.roundTwo(rawTotals.total),

          roundValue: rawTotals.roundValue,
        },
      },
    };
  }
}
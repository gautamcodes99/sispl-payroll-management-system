import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateLeavePaymentsDto } from './dto/update-leave-payments.dto';
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

  // =========================================================
  // FORM 20 - LEAVE ENCASHMENT REGISTER
  //
  // DAYS PERFORMED =
  // snapshot.payableDays - snapshot.paidHolidays
  //
  // Always zero:
  // - lay-off
  // - maternity leave with wages
  // - leave with wages enjoyed
  // - preceding year leave balance
  // - leave refused
  // - leave not desired
  // - leave enjoyed from
  // - leave enjoyed to
  //
  // LEAVE EARNED =
  // monthly total days / 20
  //
  // BALANCE TO CREDIT =
  // monthly leave earned
  //
  // NORMAL RATE OF WAGES =
  // (snapshot.monthlyBasic + snapshot.monthlyDa) / 26
  //
  // AVERAGE RATE GIVEN BY BAL-C =
  // latest month in selected year where DAYS > 0
  //
  // CASH EQUIVALENT =
  // balance to credit * AVERAGE RATE GIVEN BY BAL-C
  //
  // Remark stays blank until the Leave Pay Bank Transfer
  // payment workflow persists payment status/date.
  // =========================================================

  async getForm20(year: number) {
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

    type Form20MonthContext = {
      month: number;
      monthName: string;
      rawDaysPerformed: number;
      rawNormalRateOfWages: number | null;
      hasSnapshot: boolean;
    };

    type Form20EmployeeContext = {
      employeeId: number;
      months: Form20MonthContext[];
      latestSnapshot: Snapshot;
      latestSalaryMonth: Date;
      fatherName: string | null;
      joiningDate: Date;
    };

    const employeeMap = new Map<number, Form20EmployeeContext>();

    for (const payrollRun of currentRuns) {
      const monthIndex = payrollRun.salaryMonth.getUTCMonth();

      for (const snapshot of payrollRun.snapshots) {
        const rawDaysPerformed =
          this.number(snapshot.payableDays) -
          this.number(snapshot.paidHolidays);

        const monthlyBasic = this.number(snapshot.monthlyBasic);
        const monthlyDa = this.number(snapshot.monthlyDa);

        const rawNormalRateOfWages =
          (monthlyBasic + monthlyDa) / 26;

        let employee = employeeMap.get(snapshot.employeeId);

        if (!employee) {
          employee = {
            employeeId: snapshot.employeeId,

            months: this.monthNames.map((monthName, index) => ({
              month: index + 1,
              monthName,
              rawDaysPerformed: 0,
              rawNormalRateOfWages: null,
              hasSnapshot: false,
            })),

            latestSnapshot: snapshot,
            latestSalaryMonth: payrollRun.salaryMonth,

            fatherName: snapshot.employee.fatherName,
            joiningDate: snapshot.employee.joiningDate,
          };

          employeeMap.set(snapshot.employeeId, employee);
        }

        employee.months[monthIndex] = {
          month: monthIndex + 1,
          monthName: this.monthNames[monthIndex],
          rawDaysPerformed,
          rawNormalRateOfWages,
          hasSnapshot: true,
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
      }
    }

    const employeeContexts = Array.from(employeeMap.values()).sort(
      (a, b) => a.employeeId - b.employeeId,
    );

    const leavePayments =
      await this.benefitsReportsRepository.findLeavePaymentsForYear(
        year,
        employeeContexts.map((employee) => employee.employeeId),
      );

    const leavePaymentByEmployeeId = new Map(
      leavePayments.map((payment) => [payment.employeeId, payment]),
    );

    const employees = employeeContexts.map((employee, index) => {
      const leavePayment = leavePaymentByEmployeeId.get(employee.employeeId);

      const paymentRemark =
        leavePayment?.status === 'PAID' && leavePayment.paymentDate
          ? `Paid - ${String(leavePayment.paymentDate.getUTCDate()).padStart(
              2,
              '0',
            )}/${String(leavePayment.paymentDate.getUTCMonth() + 1).padStart(
              2,
              '0',
            )}/${leavePayment.paymentDate.getUTCFullYear()}`
          : null;
      const latestWorkedMonth = [...employee.months]
        .reverse()
        .find(
          (month) =>
            month.hasSnapshot &&
            month.rawDaysPerformed > 0 &&
            month.rawNormalRateOfWages !== null,
        );

      const rawAverageRateGivenByBalance =
        latestWorkedMonth?.rawNormalRateOfWages ?? null;

      let rawTotalDaysPerformed = 0;
      let rawTotalDays = 0;
      let rawTotalLeaveEarned = 0;
      let rawTotalLeaveCredit = 0;
      let rawTotalBalanceToCredit = 0;
      let rawTotalCashEquivalent = 0;

      const months = employee.months.map((month) => {
        const rawDaysPerformed = month.rawDaysPerformed;

        const rawDaysOfLayOff = 0;
        const rawDaysOfMaternityLeaveWithWages = 0;
        const rawDaysOfLeaveWithWagesEnjoyed = 0;

        const rawMonthTotalDays =
          rawDaysPerformed +
          rawDaysOfLayOff +
          rawDaysOfMaternityLeaveWithWages;

        const rawBalanceFromPrecedingYear = 0;

        const rawLeaveEarnedDuringYear = rawMonthTotalDays / 20;

        const rawMonthTotalLeaveCredit =
          rawBalanceFromPrecedingYear +
          rawLeaveEarnedDuringYear;

        const leaveWithWagesRefused = 0;
        const leaveWithWagesNotDesired = 0;

        const leaveEnjoyedFrom = 0;
        const leaveEnjoyedTo = 0;

        const rawBalanceToCredit = rawMonthTotalLeaveCredit;

        const rawCashEquivalent =
          rawAverageRateGivenByBalance === null
            ? 0
            : rawBalanceToCredit *
              rawAverageRateGivenByBalance;

        rawTotalDaysPerformed += rawDaysPerformed;
        rawTotalDays += rawMonthTotalDays;
        rawTotalLeaveEarned += rawLeaveEarnedDuringYear;
        rawTotalLeaveCredit += rawMonthTotalLeaveCredit;
        rawTotalBalanceToCredit += rawBalanceToCredit;
        rawTotalCashEquivalent += rawCashEquivalent;

        return {
          month: month.month,
          monthName: month.monthName,

          daysWorkedPerformed: this.roundTwo(rawDaysPerformed),

          daysOfLayOff: rawDaysOfLayOff,

          daysOfMaternityLeaveWithWages:
            rawDaysOfMaternityLeaveWithWages,

          daysOfLeaveWithWagesEnjoyed:
            rawDaysOfLeaveWithWagesEnjoyed,

          totalDays: this.roundTwo(rawMonthTotalDays),

          balanceLeaveWithWagesFromPrecedingYear:
            rawBalanceFromPrecedingYear,

          leaveWithWagesEarnedDuringYear:
            this.roundTwo(rawLeaveEarnedDuringYear),

          totalLeaveCredit:
            this.roundTwo(rawMonthTotalLeaveCredit),

          leaveWithWagesRefused,

          leaveWithWagesNotDesired,

          leaveWithWagesEnjoyedFrom: leaveEnjoyedFrom,

          leaveWithWagesEnjoyedTo: leaveEnjoyedTo,

          balanceToCredit:
            this.roundTwo(rawBalanceToCredit),

          normalRateOfWages:
            month.rawNormalRateOfWages === null
              ? null
              : this.roundTwo(
                  month.rawNormalRateOfWages,
                ),

          cashEquivalent:
            this.roundTwo(rawCashEquivalent),

          remark: null,
        };
      });

      return {
        serialNumber: index + 1,

        employeeId: employee.employeeId,

        header: {
          nameOfWorker:
            employee.latestSnapshot.employeeName,

          fatherOrHusbandName:
            employee.fatherName,

          averageRateGivenByBalance:
            rawAverageRateGivenByBalance === null
              ? null
              : this.roundTwo(
                  rawAverageRateGivenByBalance,
                ),

          dischargedWorker: null,

          ticketNumber: employee.employeeId,

          occupation:
            employee.latestSnapshot.designationName,

          pageNumberOldNew: null,

          dateOfDischarge: null,

          nameOfFactory:
            'SAIBABA INDUSTRIAL SERVICES PVT LTD',

          dateOfEntryIntoService:
            employee.joiningDate,

          workersRegisterSerialNumber: null,

          paymentMadeInLieuOfLeaveWithWages: null,

          department:
            '(CASUAL + PIECE RATE + VENDOR)',
        },

        months,

        totals: {
          daysWorkedPerformed:
            this.roundTwo(rawTotalDaysPerformed),

          daysOfLayOff: 0,

          daysOfMaternityLeaveWithWages: 0,

          daysOfLeaveWithWagesEnjoyed: 0,

          totalDays:
            this.roundTwo(rawTotalDays),

          balanceLeaveWithWagesFromPrecedingYear: 0,

          leaveWithWagesEarnedDuringYear:
            this.roundTwo(rawTotalLeaveEarned),

          totalLeaveCredit:
            this.roundTwo(rawTotalLeaveCredit),

          leaveWithWagesRefused: 0,

          leaveWithWagesNotDesired: 0,

          leaveWithWagesEnjoyedFrom: 0,

          leaveWithWagesEnjoyedTo: 0,

          balanceToCredit:
            this.roundTwo(rawTotalBalanceToCredit),

          normalRateOfWages: null,

          cashEquivalent:
            this.roundValue(rawTotalCashEquivalent),

          remark: paymentRemark,
        },
      };
    });

    return {
      success: true,

      message:
        'Form 20 - Leave Encashment Register fetched successfully.',

      data: {
        report: {
          type: 'FORM_20_LEAVE_ENCASHMENT_REGISTER',

          year,

          employeeCount: employees.length,

          fixedHeader: {
            nameOfFactory:
              'SAIBABA INDUSTRIAL SERVICES PVT LTD',

            department:
              '(CASUAL + PIECE RATE + VENDOR)',
          },

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
      },
    };
  }

  // =========================================================
  // LEAVE PAY BANK TRANSFER STATEMENT
  //
  // Employee inclusion and Amount use the already-established
  // Leave Working Sheet annual calculation.
  //
  // Amount =
  // Leave Working Sheet ROUND VALUE.
  //
  // Payment state is persisted separately in LeavePayment
  // using Employee + Leave Year.
  //
  // Absence of LeavePayment = UNPAID.
  // =========================================================

  async getLeavePayBankTransfer(year: number) {
    this.validateYear(year);

    const leaveWorkingSheet = await this.getLeaveWorkingSheet(year);

    const sourceEmployees = leaveWorkingSheet.data.employees.filter(
      (employee) => employee.status === 'QUALIFIED',
    );

    const employeeIds = sourceEmployees.map((employee) => employee.employeeId);

    const leavePayments =
      await this.benefitsReportsRepository.findLeavePaymentsForYear(
        year,
        employeeIds,
      );

    const paymentByEmployeeId = new Map(
      leavePayments.map((payment) => [payment.employeeId, payment]),
    );

    const employees = sourceEmployees.map((employee, index) => {
      const payment = paymentByEmployeeId.get(employee.employeeId);

      return {
        serialNumber: index + 1,

        employeeId: employee.employeeId,

        employeeName: employee.employeeName,

        bankName: employee.bankDetails.bankName,

        bankBranch: employee.bankDetails.bankBranch,

        ifscCode: employee.bankDetails.ifscCode,

        accountNumber: employee.bankDetails.accountNumber,

        amount: employee.roundValue,

        status: payment?.status ?? 'UNPAID',

        paymentDate: payment?.paymentDate ?? null,

        paymentMode: payment?.paymentMode ?? null,
      };
    });

    const totalAmount = employees.reduce(
      (total, employee) => total + employee.amount,
      0,
    );

    return {
      success: true,

      message: 'Leave Pay Bank Transfer Statement fetched successfully.',

      data: {
        report: {
          type: 'LEAVE_PAY_BANK_TRANSFER_STATEMENT',

          year,

          employeeCount: employees.length,
        },

        employees,

        totals: {
          amount: totalAmount,
        },
      },
    };
  }

  // =========================================================
  // LEAVE PAYMENT UPDATE
  //
  // Supports one employee or multiple selected employees.
  //
  // Entire request is validated before any write.
  // If one selected employee is not eligible for the selected
  // leave year, the complete request is rejected.
  //
  // PAID:
  // paymentDate + paymentMode required.
  //
  // UNPAID:
  // paymentDate + paymentMode must not be supplied and any
  // previously stored values are cleared.
  // =========================================================

  async updateLeavePayments(dto: UpdateLeavePaymentsDto) {
    this.validateYear(dto.year);

    if (dto.status === 'PAID') {
      if (!dto.paymentDate) {
        throw new BadRequestException(
          'Payment Date is required when Leave Payment status is PAID.',
        );
      }

      if (!dto.paymentMode) {
        throw new BadRequestException(
          'Payment Mode is required when Leave Payment status is PAID.',
        );
      }
    }

    if (
      dto.status === 'UNPAID' &&
      (dto.paymentDate !== undefined || dto.paymentMode !== undefined)
    ) {
      throw new BadRequestException(
        'Payment Date and Payment Mode must not be provided when Leave Payment status is UNPAID.',
      );
    }

    const leaveWorkingSheet = await this.getLeaveWorkingSheet(dto.year);

    const eligibleEmployeeIds = new Set(
      leaveWorkingSheet.data.employees
        .filter((employee) => employee.status === 'QUALIFIED')
        .map((employee) => employee.employeeId),
    );

    const invalidEmployeeIds = dto.employeeIds.filter(
      (employeeId) => !eligibleEmployeeIds.has(employeeId),
    );

    if (invalidEmployeeIds.length > 0) {
      throw new BadRequestException(
        `Employee ID(s) not eligible for Leave Pay in year ${dto.year}: ${invalidEmployeeIds.join(', ')}.`,
      );
    }

    let paymentDate: Date | null = null;

    if (dto.status === 'PAID' && dto.paymentDate) {
      paymentDate = new Date(dto.paymentDate);

      if (Number.isNaN(paymentDate.getTime())) {
        throw new BadRequestException('Payment Date is invalid.');
      }
    }

    const updatedPayments =
      await this.benefitsReportsRepository.upsertLeavePayments({
        leaveYear: dto.year,
        employeeIds: dto.employeeIds,
        status: dto.status,
        paymentDate,
        paymentMode: dto.status === 'PAID' ? (dto.paymentMode ?? null) : null,
      });

    return {
      success: true,

      message: 'Leave Payment status updated successfully.',

      data: {
        year: dto.year,

        updatedCount: updatedPayments.length,

        payments: updatedPayments,
      },
    };
  }
}

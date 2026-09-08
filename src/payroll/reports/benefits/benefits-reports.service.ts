import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BonusSettingAction,
  UpdateBonusSettingDto,
} from './dto/update-bonus-setting.dto';
import { UpdateBonusPaymentsDto } from './dto/update-bonus-payments.dto';
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

  // =========================================================
  // BONUS SETTING
  //
  // financialYear stores the starting year:
  // 2025 = FY 2025-2026.
  //
  // SET_AMOUNT:
  // - creates the setting when absent
  // - changes the amount only while unlocked
  //
  // LOCK:
  // - requires an existing configured amount
  //
  // UNLOCK:
  // - preserves the configured amount
  //
  // Bonus Working Sheet generation will later require an
  // existing setting with isLocked = true.
  // =========================================================

  async getBonusSetting(financialYear: number) {
    this.validateYear(financialYear);

    const setting =
      await this.benefitsReportsRepository.findBonusSetting(financialYear);

    if (!setting) {
      return {
        success: true,
        message:
          'Bonus Setting not configured for the selected financial year.',

        data: {
          financialYear,
          financialYearLabel: `${financialYear}-${financialYear + 1}`,
          configured: false,
          cappingAmount: null,
          isLocked: false,
          lockedAt: null,
        },
      };
    }

    return {
      success: true,
      message: 'Bonus Setting fetched successfully.',

      data: {
        financialYear: setting.financialYear,
        financialYearLabel:
          `${setting.financialYear}-${setting.financialYear + 1}`,
        configured: true,
        cappingAmount: this.roundTwo(
          this.number(setting.cappingAmount),
        ),
        isLocked: setting.isLocked,
        lockedAt: setting.lockedAt,
      },
    };
  }

  async updateBonusSetting(dto: UpdateBonusSettingDto) {
    this.validateYear(dto.financialYear);

    const existing =
      await this.benefitsReportsRepository.findBonusSetting(
        dto.financialYear,
      );

    if (dto.action === BonusSettingAction.SET_AMOUNT) {
      if (dto.cappingAmount === undefined) {
        throw new BadRequestException(
          'Capping Amount is required for SET_AMOUNT.',
        );
      }

      if (
        !Number.isFinite(dto.cappingAmount) ||
        dto.cappingAmount <= 0
      ) {
        throw new BadRequestException(
          'Capping Amount must be greater than zero.',
        );
      }

      if (existing?.isLocked) {
        throw new ConflictException(
          `Bonus Setting for FY ${dto.financialYear}-${dto.financialYear + 1} is locked. Unlock it before changing the capping amount.`,
        );
      }

      const setting =
        await this.benefitsReportsRepository.upsertBonusSettingAmount(
          dto.financialYear,
          dto.cappingAmount,
        );

      return {
        success: true,
        message: 'Bonus capping amount saved successfully.',

        data: {
          financialYear: setting.financialYear,
          financialYearLabel:
            `${setting.financialYear}-${setting.financialYear + 1}`,
          configured: true,
          cappingAmount: this.roundTwo(
            this.number(setting.cappingAmount),
          ),
          isLocked: setting.isLocked,
          lockedAt: setting.lockedAt,
        },
      };
    }

    if (dto.cappingAmount !== undefined) {
      throw new BadRequestException(
        'Capping Amount must only be provided for SET_AMOUNT.',
      );
    }

    if (dto.action === BonusSettingAction.LOCK) {
      if (!existing) {
        throw new NotFoundException(
          `Bonus Setting is not configured for FY ${dto.financialYear}-${dto.financialYear + 1}.`,
        );
      }

      if (existing.isLocked) {
        throw new ConflictException(
          `Bonus Setting for FY ${dto.financialYear}-${dto.financialYear + 1} is already locked.`,
        );
      }

      if (this.number(existing.cappingAmount) <= 0) {
        throw new BadRequestException(
          'A valid Bonus capping amount is required before locking.',
        );
      }

      const setting =
        await this.benefitsReportsRepository.updateBonusSettingLock(
          dto.financialYear,
          true,
          new Date(),
        );

      return {
        success: true,
        message: 'Bonus Setting locked successfully.',

        data: {
          financialYear: setting.financialYear,
          financialYearLabel:
            `${setting.financialYear}-${setting.financialYear + 1}`,
          configured: true,
          cappingAmount: this.roundTwo(
            this.number(setting.cappingAmount),
          ),
          isLocked: setting.isLocked,
          lockedAt: setting.lockedAt,
        },
      };
    }

    if (dto.action === BonusSettingAction.UNLOCK) {
      if (!existing) {
        throw new NotFoundException(
          `Bonus Setting is not configured for FY ${dto.financialYear}-${dto.financialYear + 1}.`,
        );
      }

      if (!existing.isLocked) {
        throw new ConflictException(
          `Bonus Setting for FY ${dto.financialYear}-${dto.financialYear + 1} is already unlocked.`,
        );
      }

      const setting =
        await this.benefitsReportsRepository.updateBonusSettingLock(
          dto.financialYear,
          false,
          null,
        );

      return {
        success: true,
        message: 'Bonus Setting unlocked successfully.',

        data: {
          financialYear: setting.financialYear,
          financialYearLabel:
            `${setting.financialYear}-${setting.financialYear + 1}`,
          configured: true,
          cappingAmount: this.roundTwo(
            this.number(setting.cappingAmount),
          ),
          isLocked: setting.isLocked,
          lockedAt: setting.lockedAt,
        },
      };
    }

    throw new BadRequestException(
      'Bonus Setting action is invalid.',
    );
  }

  // =========================================================
  // BONUS WORKING SHEET
  //
  // FINANCIAL YEAR:
  // April of financialYear through March of financialYear + 1.
  //
  // DAYS =
  // snapshot.payableDays
  //
  // MIN WAGES =
  // (snapshot.monthlyBasic + snapshot.monthlyDa) / 26
  //
  // BASIC SALRAY =
  // snapshot.wages
  //
  // PAID DAYS =
  // annual sum of snapshot.payableDays
  //
  // ANNUAL BASIC SALRAY =
  // annual sum of snapshot.wages
  //
  // QUALIFIED =
  // PAID DAYS >= 30
  //
  // RAW BONUS =
  // ANNUAL BASIC SALRAY * 8.33%
  //
  // TOTAL BONUS PAID =
  // min(RAW BONUS, locked FY capping amount)
  //
  // Qualification controls STATUS only.
  // Both QUALIFIED and UNQUALIFIED employees retain their
  // calculated Bonus Working Sheet amount.
  //
  // Final TOTAL BONUS PAID is rounded to the nearest rupee.
  //
  // Bank Name / Account Number =
  // latest available payroll snapshot within the selected FY.
  // =========================================================

  async getBonusWorkingSheet(financialYear: number) {
    this.validateYear(financialYear);

    const bonusSetting =
      await this.benefitsReportsRepository.findBonusSetting(financialYear);

    if (!bonusSetting) {
      throw new NotFoundException(
        `Bonus Setting is not configured for FY ${financialYear}-${financialYear + 1}.`,
      );
    }

    if (!bonusSetting.isLocked) {
      throw new ConflictException(
        `Bonus Setting for FY ${financialYear}-${financialYear + 1} must be locked before generating the Bonus Working Sheet.`,
      );
    }

    const rawCappingAmount = this.number(bonusSetting.cappingAmount);

    if (rawCappingAmount <= 0) {
      throw new BadRequestException(
        'Bonus capping amount must be greater than zero.',
      );
    }

    const financialYearStart = new Date(
      Date.UTC(financialYear, 3, 1),
    );

    const nextFinancialYearStart = new Date(
      Date.UTC(financialYear + 1, 3, 1),
    );

    const payrollRuns =
      await this.benefitsReportsRepository.findCurrentReportablePayrollRunsForYear(
        financialYearStart,
        nextFinancialYearStart,
      );

    if (payrollRuns.length === 0) {
      throw new NotFoundException(
        `No current reportable Payroll Runs found for FY ${financialYear}-${financialYear + 1}.`,
      );
    }

    const currentRunBySalaryMonth = new Map<
      string,
      (typeof payrollRuns)[number]
    >();

    for (const payrollRun of payrollRuns) {
      const salaryMonthKey =
        `${payrollRun.salaryMonth.getUTCFullYear()}-` +
        `${String(payrollRun.salaryMonth.getUTCMonth() + 1).padStart(2, '0')}`;

      const existing = currentRunBySalaryMonth.get(salaryMonthKey);

      if (!existing || payrollRun.version > existing.version) {
        currentRunBySalaryMonth.set(salaryMonthKey, payrollRun);
      }
    }

    const currentRuns = Array.from(
      currentRunBySalaryMonth.values(),
    ).sort(
      (a, b) =>
        a.salaryMonth.getTime() - b.salaryMonth.getTime() ||
        b.version - a.version,
    );

    type Snapshot = (typeof currentRuns)[number]['snapshots'][number];

    const financialYearMonths = [
      { month: 4, monthName: 'april' },
      { month: 5, monthName: 'may' },
      { month: 6, monthName: 'june' },
      { month: 7, monthName: 'july' },
      { month: 8, monthName: 'august' },
      { month: 9, monthName: 'september' },
      { month: 10, monthName: 'october' },
      { month: 11, monthName: 'november' },
      { month: 12, monthName: 'december' },
      { month: 1, monthName: 'january' },
      { month: 2, monthName: 'february' },
      { month: 3, monthName: 'march' },
    ] as const;

    type BonusMonthContext = {
      month: number;
      monthName: string;
      rawDays: number | null;
      rawMinimumWages: number | null;
      rawBasicSalary: number | null;
    };

    type BonusEmployeeContext = {
      employeeId: number;
      months: BonusMonthContext[];
      latestSnapshot: Snapshot;
      latestSalaryMonth: Date;
    };

    const employeeMap = new Map<number, BonusEmployeeContext>();

    for (const payrollRun of currentRuns) {
      const calendarMonth = payrollRun.salaryMonth.getUTCMonth() + 1;

      const financialMonthIndex = financialYearMonths.findIndex(
        (month) => month.month === calendarMonth,
      );

      if (financialMonthIndex < 0) {
        continue;
      }

      for (const snapshot of payrollRun.snapshots) {
        const rawDays = this.number(snapshot.payableDays);

        const rawMinimumWages =
          (
            this.number(snapshot.monthlyBasic) +
            this.number(snapshot.monthlyDa)
          ) / 26;

        const rawBasicSalary = this.number(snapshot.wages);

        let employee = employeeMap.get(snapshot.employeeId);

        if (!employee) {
          employee = {
            employeeId: snapshot.employeeId,

            months: financialYearMonths.map((month) => ({
              month: month.month,
              monthName: month.monthName,
              rawDays: null,
              rawMinimumWages: null,
              rawBasicSalary: null,
            })),

            latestSnapshot: snapshot,
            latestSalaryMonth: payrollRun.salaryMonth,
          };

          employeeMap.set(snapshot.employeeId, employee);
        }

        employee.months[financialMonthIndex] = {
          month: calendarMonth,
          monthName:
            financialYearMonths[financialMonthIndex].monthName,
          rawDays,
          rawMinimumWages,
          rawBasicSalary,
        };

        if (
          payrollRun.salaryMonth.getTime() >
          employee.latestSalaryMonth.getTime()
        ) {
          employee.latestSnapshot = snapshot;
          employee.latestSalaryMonth = payrollRun.salaryMonth;
        }
      }
    }

    const employeeContexts = Array.from(employeeMap.values()).sort(
      (a, b) => a.employeeId - b.employeeId,
    );

    const bonusRatePercentage = 8.33;
    const bonusRate = 0.0833;

    const employees = employeeContexts.map((employee, index) => {
      const rawPaidDays = employee.months.reduce(
        (total, month) => total + (month.rawDays ?? 0),
        0,
      );

      const rawAnnualBasicSalary = employee.months.reduce(
        (total, month) => total + (month.rawBasicSalary ?? 0),
        0,
      );

      const qualified = rawPaidDays >= 30;

      const rawBonus = rawAnnualBasicSalary * bonusRate;

      const rawCappedBonus = Math.min(
        rawBonus,
        rawCappingAmount,
      );

      const totalBonusPaid = this.roundValue(rawCappedBonus);

      return {
        serialNumber: index + 1,

        employeeId: employee.employeeId,

        employeeName: employee.latestSnapshot.employeeName,

        months: employee.months.map((month) => ({
          month: month.month,
          monthName: month.monthName,

          days:
            month.rawDays === null
              ? null
              : this.roundTwo(month.rawDays),

          minimumWages:
            month.rawMinimumWages === null
              ? null
              : this.roundTwo(month.rawMinimumWages),

          basicSalary:
            month.rawBasicSalary === null
              ? null
              : this.roundTwo(month.rawBasicSalary),
        })),

        paidDays: this.roundTwo(rawPaidDays),

        annualBasicSalary: this.roundTwo(rawAnnualBasicSalary),

        bonusRatePercentage,

        rawBonus: this.roundTwo(rawBonus),

        totalBonusPaid,

        bankName: employee.latestSnapshot.bankName,

        bankBranch: employee.latestSnapshot.bankBranch,

        ifscCode: employee.latestSnapshot.ifscCode,

        accountNumber: employee.latestSnapshot.accountNumber,

        status: qualified ? 'QUALIFIED' : 'UNQUALIFIED',
      };
    });

    const monthlyTotals = financialYearMonths.map(
      (month, monthIndex) => ({
        month: month.month,
        monthName: month.monthName,

        days: this.roundTwo(
          employeeContexts.reduce(
            (total, employee) =>
              total +
              (employee.months[monthIndex].rawDays ?? 0),
            0,
          ),
        ),

        basicSalary: this.roundTwo(
          employeeContexts.reduce(
            (total, employee) =>
              total +
              (employee.months[monthIndex].rawBasicSalary ?? 0),
            0,
          ),
        ),
      }),
    );

    const totals = employees.reduce(
      (result, employee) => {
        result.paidDays += employee.paidDays;
        result.annualBasicSalary += employee.annualBasicSalary;
        result.rawBonus += employee.rawBonus;
        result.totalBonusPaid += employee.totalBonusPaid;

        return result;
      },
      {
        paidDays: 0,
        annualBasicSalary: 0,
        rawBonus: 0,
        totalBonusPaid: 0,
      },
    );

    return {
      success: true,

      message: 'Bonus Working Sheet fetched successfully.',

      data: {
        report: {
          type: 'BONUS_WORKING_SHEET',

          financialYear,

          financialYearLabel:
            `${financialYear}-${financialYear + 1}`,

          period: {
            from: financialYearStart,
            to: new Date(
              Date.UTC(financialYear + 1, 2, 31),
            ),
          },

          bonusRatePercentage,

          cappingAmount: this.roundTwo(rawCappingAmount),

          cappingLockedAt: bonusSetting.lockedAt,

          employeeCount: employees.length,

          qualifiedEmployeeCount: employees.filter(
            (employee) => employee.status === 'QUALIFIED',
          ).length,

          unqualifiedEmployeeCount: employees.filter(
            (employee) => employee.status === 'UNQUALIFIED',
          ).length,

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
          monthly: monthlyTotals,

          paidDays: this.roundTwo(totals.paidDays),

          annualBasicSalary: this.roundTwo(
            totals.annualBasicSalary,
          ),

          rawBonus: this.roundTwo(totals.rawBonus),

          totalBonusPaid: totals.totalBonusPaid,
        },
      },
    };
  }
  // =========================================================
  // BONUS BANK TRANSFER STATEMENT
  //
  // Source of truth:
  // Bonus Working Sheet.
  //
  // Only QUALIFIED employees are included:
  // paidDays >= 30.
  //
  // Amount =
  // Bonus Working Sheet totalBonusPaid.
  //
  // Bank details come from the same latest FY payroll
  // snapshot used by the Bonus Working Sheet.
  //
  // Payment state is shared through BonusPayment.
  //
  // Absence of BonusPayment = UNPAID.
  // =========================================================

  async getBonusBankTransfer(financialYear: number) {
    this.validateYear(financialYear);

    const bonusWorkingSheet =
      await this.getBonusWorkingSheet(financialYear);

    const sourceEmployees =
      bonusWorkingSheet.data.employees.filter(
        (employee) => employee.status === 'QUALIFIED',
      );

    const employeeIds = sourceEmployees.map(
      (employee) => employee.employeeId,
    );

    const bonusPayments =
      await this.benefitsReportsRepository.findBonusPaymentsForFinancialYear(
        financialYear,
        employeeIds,
      );

    const paymentByEmployeeId = new Map(
      bonusPayments.map((payment) => [
        payment.employeeId,
        payment,
      ]),
    );

    const employees = sourceEmployees.map(
      (employee, index) => {
        const payment = paymentByEmployeeId.get(
          employee.employeeId,
        );

        return {
          serialNumber: index + 1,

          employeeId: employee.employeeId,

          employeeName: employee.employeeName,

          bankName: employee.bankName,

          bankBranch: employee.bankBranch,

          ifscCode: employee.ifscCode,

          accountNumber: employee.accountNumber,

          amount: employee.totalBonusPaid,

          status: payment?.status ?? 'UNPAID',

          paymentDate:
            payment?.status === 'PAID'
              ? (payment.paymentDate ?? null)
              : null,

          paymentMode:
            payment?.status === 'PAID'
              ? (payment.paymentMode ?? null)
              : null,
        };
      },
    );

    const totalAmount = employees.reduce(
      (total, employee) => total + employee.amount,
      0,
    );

    return {
      success: true,

      message:
        'Bonus Bank Transfer Statement fetched successfully.',

      data: {
        report: {
          type: 'BONUS_BANK_TRANSFER_STATEMENT',

          financialYear,

          financialYearLabel:
            `${financialYear}-${financialYear + 1}`,

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
  // BONUS PAYMENT UPDATE
  //
  // Supports one employee or multiple selected employees.
  //
  // Entire request is validated before any write.
  // If one selected employee is not QUALIFIED for the
  // selected financial year, the complete request is rejected.
  //
  // PAID:
  // paymentDate + paymentMode required.
  //
  // UNPAID:
  // paymentDate + paymentMode must not be supplied and any
  // previously stored values are cleared.
  //
  // BonusPayment is shared by Bonus Bank Transfer + Form-C.
  // =========================================================

  async updateBonusPayments(dto: UpdateBonusPaymentsDto) {
    this.validateYear(dto.financialYear);

    if (dto.status === 'PAID') {
      if (!dto.paymentDate) {
        throw new BadRequestException(
          'Payment Date is required when Bonus Payment status is PAID.',
        );
      }

      if (!dto.paymentMode) {
        throw new BadRequestException(
          'Payment Mode is required when Bonus Payment status is PAID.',
        );
      }
    }

    if (
      dto.status === 'UNPAID' &&
      (dto.paymentDate !== undefined ||
        dto.paymentMode !== undefined)
    ) {
      throw new BadRequestException(
        'Payment Date and Payment Mode must not be provided when Bonus Payment status is UNPAID.',
      );
    }

    const bonusWorkingSheet =
      await this.getBonusWorkingSheet(dto.financialYear);

    const eligibleEmployeeIds = new Set(
      bonusWorkingSheet.data.employees
        .filter(
          (employee) => employee.status === 'QUALIFIED',
        )
        .map((employee) => employee.employeeId),
    );

    const invalidEmployeeIds = dto.employeeIds.filter(
      (employeeId) => !eligibleEmployeeIds.has(employeeId),
    );

    if (invalidEmployeeIds.length > 0) {
      throw new BadRequestException(
        `Employee ID(s) not eligible for Bonus Payment in FY ${dto.financialYear}-${dto.financialYear + 1}: ${invalidEmployeeIds.join(', ')}.`,
      );
    }

    let paymentDate: Date | null = null;

    if (dto.status === 'PAID' && dto.paymentDate) {
      paymentDate = new Date(dto.paymentDate);

      if (Number.isNaN(paymentDate.getTime())) {
        throw new BadRequestException(
          'Payment Date is invalid.',
        );
      }
    }

    const updatedPayments =
      await this.benefitsReportsRepository.upsertBonusPayments({
        financialYear: dto.financialYear,

        employeeIds: dto.employeeIds,

        status: dto.status,

        paymentDate,

        paymentMode:
          dto.status === 'PAID'
            ? (dto.paymentMode ?? null)
            : null,
      });

    return {
      success: true,

      message: 'Bonus Payment status updated successfully.',

      data: {
        financialYear: dto.financialYear,

        financialYearLabel:
          `${dto.financialYear}-${dto.financialYear + 1}`,

        updatedCount: updatedPayments.length,

        payments: updatedPayments,
      },
    };
  }
  // =========================================================
  // BONUS FORM-C
  //
  // Source of truth:
  // Bonus Working Sheet.
  //
  // Only QUALIFIED employees are included:
  // paidDays >= 30.
  //
  // Bonus payable comes from the existing Bonus Working
  // Sheet totalBonusPaid value.
  //
  // Current deductions are zero.
  //
  // Payment state is shared through BonusPayment.
  //
  // No BonusPayment record is treated as UNPAID.
  //
  // UNPAID:
  // amountActuallyPaid = 0
  // paymentDate = null
  //
  // PAID:
  // amountActuallyPaid = netAmountPayable
  // paymentDate = BonusPayment.paymentDate
  //
  // Remarks remain blank.
  // =========================================================

  async getBonusFormC(financialYear: number) {
    this.validateYear(financialYear);

    const bonusWorkingSheet =
      await this.getBonusWorkingSheet(financialYear);

    const qualifiedEmployees =
      bonusWorkingSheet.data.employees.filter(
        (employee) => employee.status === 'QUALIFIED',
      );

    const employeeIds = qualifiedEmployees.map(
      (employee) => employee.employeeId,
    );

    const bonusPayments =
      await this.benefitsReportsRepository.findBonusPaymentsForFinancialYear(
        financialYear,
        employeeIds,
      );

    const paymentByEmployeeId = new Map(
      bonusPayments.map((payment) => [
        payment.employeeId,
        payment,
      ]),
    );

    const employees = qualifiedEmployees.map(
      (employee, index) => {
        const payment = paymentByEmployeeId.get(
          employee.employeeId,
        );

        const isPaid = payment?.status === 'PAID';

        const bonusPayable = employee.totalBonusPaid;

        const pujaCustomaryBonus = 0;
        const interimAdvanceBonus = 0;
        const incomeTaxDeducted = 0;
        const financialLossDeduction = 0;

        const totalDeduction =
          interimAdvanceBonus +
          incomeTaxDeducted +
          financialLossDeduction;

        const netAmountPayable =
          bonusPayable - totalDeduction;

        return {
          serialNumber: index + 1,

          employeeId: employee.employeeId,

          employeeName: employee.employeeName,

          completed15Years: 'YES',

          daysWorked: employee.paidDays,

          totalSalaryOrWages:
            employee.annualBasicSalary,

          bonusPayable,

          pujaCustomaryBonus,

          interimAdvanceBonus,

          incomeTaxDeducted,

          financialLossDeduction,

          totalDeduction,

          netAmountPayable,

          amountActuallyPaid:
            isPaid ? netAmountPayable : 0,

          paymentDate:
            isPaid && payment?.paymentDate
              ? payment.paymentDate
              : null,

          bankName: employee.bankName,

          accountNumber: employee.accountNumber,

          remarks: null,
        };
      },
    );

    const totals = employees.reduce(
      (result, employee) => {
        result.daysWorked += employee.daysWorked;

        result.totalSalaryOrWages +=
          employee.totalSalaryOrWages;

        result.bonusPayable +=
          employee.bonusPayable;

        result.pujaCustomaryBonus +=
          employee.pujaCustomaryBonus;

        result.interimAdvanceBonus +=
          employee.interimAdvanceBonus;

        result.incomeTaxDeducted +=
          employee.incomeTaxDeducted;

        result.financialLossDeduction +=
          employee.financialLossDeduction;

        result.totalDeduction +=
          employee.totalDeduction;

        result.netAmountPayable +=
          employee.netAmountPayable;

        result.amountActuallyPaid +=
          employee.amountActuallyPaid;

        return result;
      },
      {
        daysWorked: 0,
        totalSalaryOrWages: 0,
        bonusPayable: 0,
        pujaCustomaryBonus: 0,
        interimAdvanceBonus: 0,
        incomeTaxDeducted: 0,
        financialLossDeduction: 0,
        totalDeduction: 0,
        netAmountPayable: 0,
        amountActuallyPaid: 0,
      },
    );

    return {
      success: true,

      message: 'Bonus Form-C fetched successfully.',

      data: {
        report: {
          type: 'BONUS_FORM_C',

          financialYear,

          financialYearLabel:
            `${financialYear}-${financialYear + 1}`,

          accountingYearEnding:
            new Date(
              Date.UTC(financialYear + 1, 2, 31),
            ),

          employeeCount: employees.length,
        },

        employees,

        totals: {
          daysWorked:
            this.roundTwo(totals.daysWorked),

          totalSalaryOrWages:
            this.roundTwo(
              totals.totalSalaryOrWages,
            ),

          bonusPayable:
            totals.bonusPayable,

          pujaCustomaryBonus:
            totals.pujaCustomaryBonus,

          interimAdvanceBonus:
            totals.interimAdvanceBonus,

          incomeTaxDeducted:
            totals.incomeTaxDeducted,

          financialLossDeduction:
            totals.financialLossDeduction,

          totalDeduction:
            totals.totalDeduction,

          netAmountPayable:
            totals.netAmountPayable,

          amountActuallyPaid:
            totals.amountActuallyPaid,
        },
      },
    };
  }
}

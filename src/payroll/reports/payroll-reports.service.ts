import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollReportsRepository } from './repository/payroll-reports.repository';
import { ManualDeductionService } from '../../manual-deduction/service/manual-deduction.service';

@Injectable()
export class PayrollReportsService {
  constructor(
    private readonly payrollReportsRepository: PayrollReportsRepository,
    private readonly manualDeductionService: ManualDeductionService,
  ) {}

  // =========================================================
  // SALARY MONTH
  // =========================================================

  private normalizeSalaryMonth(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth(), 1),
    );
  }

  // =========================================================
  // MONEY
  //
  // Report output is standardized to 2 decimal places.
  //
  // Payroll values themselves come from the persisted
  // finalized snapshot. We do NOT recalculate payroll here.
  // =========================================================

  private money(value: unknown): number {
    return Number(Number(value ?? 0).toFixed(2));
  }

  // =========================================================
  // SITE
  // =========================================================

  private async getSiteOrThrow(siteId: number) {
    const site =
      await this.payrollReportsRepository.findSiteById(siteId);

    if (!site) {
      throw new NotFoundException(
        `Site with ID ${siteId} not found.`,
      );
    }

    return site;
  }

  // =========================================================
  // WAGE SHEET
  //
  // Internal SISPL company Wage Sheet.
  //
  // Source of truth:
  // PayrollEmployeeSnapshot
  //
  // No recalculation of:
  // - wages
  // - OT
  // - HRA
  // - gross
  // - statutory deductions
  // - manual deductions
  // - net salary
  //
  // Only report-only derived value:
  // Minimum Wage Per Day = (Monthly Basic + Monthly DA) / 26
  //
  // DATE OF PAYMENT and MODE OF PAYMENT come from the
  // existing optional PayrollPayment record belonging to the
  // finalized PayrollEmployeeSnapshot.
  //
  // No payment row means:
  // UNPAID / null date / null mode.
  // =========================================================

  async getWageSheet(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const monthlyBasic = this.money(snapshot.monthlyBasic);
      const monthlyDa = this.money(snapshot.monthlyDa);

      const minimumWagePerDay = this.money((monthlyBasic + monthlyDa) / 26);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        uanNumber: snapshot.uanNumber,
        esicNumber: snapshot.esicNumber,

        gender: snapshot.gender,
        designation: snapshot.designationName,

        monthlyBasic,
        monthlyDa,

        minimumWagePerDay,

        presentDays: Number(snapshot.presentDays),
        halfDays: Number(snapshot.halfDays),
        paidHolidays: Number(snapshot.paidHolidays),
        payableDays: Number(snapshot.payableDays),

        wages: this.money(snapshot.wages),

        otHours: Number(snapshot.otHours),
        otRate: this.money(snapshot.otRate),
        otAmount: this.money(snapshot.otAmount),

        hra: this.money(snapshot.hra),
        conveyance: this.money(snapshot.conveyance),
        specialAllowance: this.money(snapshot.specialAllowanceAmount),
        rab: this.money(snapshot.rab),
        arrears: this.money(snapshot.arrears),

        grossPay: this.money(snapshot.gross),

        esic: this.money(snapshot.esic),
        pf: this.money(snapshot.pf),
        ptax: this.money(snapshot.ptax),
        mlwf: this.money(snapshot.mlwf),

        advance: this.money(snapshot.advanceRecovery),
        canteen: this.money(snapshot.canteen),
        uniform: this.money(snapshot.uniformRecovery),
        fine: this.money(snapshot.fine),
        transport: this.money(snapshot.transport),
        otherDeduction: this.money(snapshot.otherDeduction),

        totalDeduction: this.money(snapshot.totalDeductions),

        netPaid: this.money(snapshot.netSalary),

        payment: {
          status: snapshot.payment?.status ?? 'UNPAID',
          paymentDate: snapshot.payment?.paymentDate ?? null,
          paymentMode: snapshot.payment?.paymentMode ?? null,
        },
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.monthlyBasic += employee.monthlyBasic;
        total.monthlyDa += employee.monthlyDa;

        total.presentDays += employee.presentDays;
        total.halfDays += employee.halfDays;
        total.paidHolidays += employee.paidHolidays;
        total.payableDays += employee.payableDays;

        total.wages += employee.wages;

        total.otHours += employee.otHours;
        total.otAmount += employee.otAmount;

        total.hra += employee.hra;
        total.conveyance += employee.conveyance;
        total.specialAllowance += employee.specialAllowance;
        total.rab += employee.rab;
        total.arrears += employee.arrears;

        total.grossPay += employee.grossPay;

        total.esic += employee.esic;
        total.pf += employee.pf;
        total.ptax += employee.ptax;
        total.mlwf += employee.mlwf;

        total.advance += employee.advance;
        total.canteen += employee.canteen;
        total.uniform += employee.uniform;
        total.fine += employee.fine;
        total.transport += employee.transport;
        total.otherDeduction += employee.otherDeduction;

        total.totalDeduction += employee.totalDeduction;

        total.netPaid += employee.netPaid;

        return total;
      },
      {
        monthlyBasic: 0,
        monthlyDa: 0,

        presentDays: 0,
        halfDays: 0,
        paidHolidays: 0,
        payableDays: 0,

        wages: 0,

        otHours: 0,
        otAmount: 0,

        hra: 0,
        conveyance: 0,
        specialAllowance: 0,
        rab: 0,
        arrears: 0,

        grossPay: 0,

        esic: 0,
        pf: 0,
        ptax: 0,
        mlwf: 0,

        advance: 0,
        canteen: 0,
        uniform: 0,
        fine: 0,
        transport: 0,
        otherDeduction: 0,

        totalDeduction: 0,

        netPaid: 0,
      },
    );

    return {
      success: true,
      message: 'Wage Sheet report fetched successfully.',

      data: {
        report: {
          type: 'WAGE_SHEET',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          monthlyBasic: this.money(totals.monthlyBasic),
          monthlyDa: this.money(totals.monthlyDa),

          presentDays: Number(totals.presentDays.toFixed(1)),
          halfDays: Number(totals.halfDays.toFixed(1)),
          paidHolidays: Number(totals.paidHolidays.toFixed(1)),
          payableDays: Number(totals.payableDays.toFixed(1)),

          wages: this.money(totals.wages),

          otHours: Number(totals.otHours.toFixed(2)),
          otAmount: this.money(totals.otAmount),

          hra: this.money(totals.hra),
          conveyance: this.money(totals.conveyance),
          specialAllowance: this.money(totals.specialAllowance),
          rab: this.money(totals.rab),
          arrears: this.money(totals.arrears),

          grossPay: this.money(totals.grossPay),

          esic: this.money(totals.esic),
          pf: this.money(totals.pf),
          ptax: this.money(totals.ptax),
          mlwf: this.money(totals.mlwf),

          advance: this.money(totals.advance),
          canteen: this.money(totals.canteen),
          uniform: this.money(totals.uniform),
          fine: this.money(totals.fine),
          transport: this.money(totals.transport),
          otherDeduction: this.money(totals.otherDeduction),

          totalDeduction: this.money(totals.totalDeduction),

          netPaid: this.money(totals.netPaid),
        },
      },
    };
  }

  // =========================================================
  // FORM II - ATTENDANCE STATUS -> REPORT CODE
  //
  // Must remain consistent with the finalized Attendance
  // Reports specification.
  //
  // LEAVE / HOLIDAY are intentionally ignored.
  // =========================================================

  private mapFormIiAttendanceCode(status: string): string {
    switch (status) {
      case 'PRESENT':
        return 'P';

      case 'ABSENT':
        return 'A';

      case 'WEEKLY_OFF':
        return 'WO';

      case 'HALF_DAY':
        return 'HD';

      case 'PAID_HOLIDAY':
        return 'PH';

      case 'LEAVE':
      case 'HOLIDAY':
      default:
        return '';
    }
  }
  private getFormIiShiftOrder(shift: string): number {
    switch (shift) {
      case 'FIRST':
        return 1;
      case 'SECOND':
        return 2;
      case 'THIRD':
        return 3;
      default:
        return 999;
    }
  }

  private sortFormIiAttendanceCodes(
    entries: Array<{ shift: string; code: string }>,
  ): Array<{ shift: string; code: string }> {
    return entries.sort(
      (a, b) =>
        this.getFormIiShiftOrder(a.shift) - this.getFormIiShiftOrder(b.shift),
    );
  }

  // =========================================================
  // FORM II - AGE
  //
  // Age is derived from Employee Master DOB as of the
  // salary month.
  //
  // No employee master data is modified.
  // =========================================================

  private calculateAge(
    dateOfBirth: Date | null,
    salaryMonth: Date,
  ): number | null {
    if (!dateOfBirth) {
      return null;
    }

    let age = salaryMonth.getUTCFullYear() - dateOfBirth.getUTCFullYear();

    const monthDifference =
      salaryMonth.getUTCMonth() - dateOfBirth.getUTCMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 &&
        salaryMonth.getUTCDate() < dateOfBirth.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  // =========================================================
  // FORM II - MUSTER ROLL CUM WAGE REGISTER
  //
  // Company-wide statutory Payroll Report.
  //
  // Sources:
  // - PayrollEmployeeSnapshot -> historical payroll values
  // - Attendance              -> daily attendance codes
  // - Employee Master         -> DOB / DOJ
  // - PayrollPayment          -> payment date / payment mode
  //
  // Employee Master details are fetched independently from
  // Attendance so an employee with zero Attendance can still
  // show available DOB / DOJ details.
  //
  // No Site / Work Type / Department filtering.
  //
  // Ignored for now:
  // - Leave with Wages BM:BP
  // =========================================================

  async getFormIi(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employeeIds = payrollRun.snapshots.map(
      (snapshot) => snapshot.employeeId,
    );

    const [attendances, employeeDetails, paymentContexts] = await Promise.all([
      this.payrollReportsRepository.findFormIiMonthlyAttendance(
        salaryMonth,
        employeeIds,
        siteId,
      ),

      this.payrollReportsRepository.findFormIiEmployeeDetails(employeeIds),

      this.payrollReportsRepository.findPayrollSnapshotsPaymentContext(
        payrollRun.snapshots.map((snapshot) => snapshot.id),
      ),
    ]);

    const employeeDetailsById = new Map(
      employeeDetails.map((employee) => [employee.id, employee]),
    );

    const paymentBySnapshotId = new Map(
      paymentContexts.map((snapshot) => [snapshot.id, snapshot.payment]),
    );

    const daysInMonth = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();

    type AttendanceEmployeeContext = {
      attendanceByDay: Map<number, Array<{ shift: string; code: string }>>;
    };

    const attendanceByEmployee = new Map<number, AttendanceEmployeeContext>();

    for (const attendance of attendances) {
      let employeeContext = attendanceByEmployee.get(attendance.employeeId);

      if (!employeeContext) {
        employeeContext = {
          attendanceByDay: new Map(),
        };

        attendanceByEmployee.set(attendance.employeeId, employeeContext);
      }

      const code = this.mapFormIiAttendanceCode(attendance.status);

      if (!code) {
        continue;
      }

      const day = attendance.attendanceDate.getUTCDate();

      const dayEntries = employeeContext.attendanceByDay.get(day) ?? [];

      dayEntries.push({
        shift: attendance.shift,
        code,
      });

      employeeContext.attendanceByDay.set(day, dayEntries);
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const attendanceContext = attendanceByEmployee.get(snapshot.employeeId);

      const employeeDetail = employeeDetailsById.get(snapshot.employeeId);

      const payment = paymentBySnapshotId.get(snapshot.id);

      const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const day = dayIndex + 1;

        const entries = this.sortFormIiAttendanceCodes(
          attendanceContext?.attendanceByDay.get(day) ?? [],
        );

        return {
          day,
          code: entries.map((entry) => entry.code).join('/'),
        };
      });

      const monthlyBasic = this.money(snapshot.monthlyBasic);
      const monthlyDa = this.money(snapshot.monthlyDa);

      const minimumWagePerDay = this.money((monthlyBasic + monthlyDa) / 26);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        uanNumber: snapshot.uanNumber,
        esicNumber: snapshot.esicNumber,

        age: this.calculateAge(
          employeeDetail?.dateOfBirth ?? null,
          salaryMonth,
        ),

        gender: snapshot.gender,

        joiningDate: employeeDetail?.joiningDate ?? null,

        designation: snapshot.designationName,

        days,

        presentDays: Number(snapshot.presentDays),
        halfDays: Number(snapshot.halfDays),
        paidHolidays: Number(snapshot.paidHolidays),
        payableDays: Number(snapshot.payableDays),

        monthlyBasic,
        monthlyDa,
        minimumWagePerDay,

        wages: this.money(snapshot.wages),

        otHours: Number(snapshot.otHours),
        otRate: this.money(snapshot.otRate),
        otAmount: this.money(snapshot.otAmount),

        hra: this.money(snapshot.hra),
        conveyance: this.money(snapshot.conveyance),

        specialAllowance: this.money(snapshot.specialAllowanceAmount),

        rab: this.money(snapshot.rab),
        arrears: this.money(snapshot.arrears),

        grossPay: this.money(snapshot.gross),

        pf: this.money(snapshot.pf),
        esic: this.money(snapshot.esic),
        ptax: this.money(snapshot.ptax),
        mlwf: this.money(snapshot.mlwf),

        advance: this.money(snapshot.advanceRecovery),
        canteen: this.money(snapshot.canteen),
        uniform: this.money(snapshot.uniformRecovery),
        fine: this.money(snapshot.fine),
        transport: this.money(snapshot.transport),
        otherDeduction: this.money(snapshot.otherDeduction),

        totalDeduction: this.money(snapshot.totalDeductions),

        netWages: this.money(snapshot.netSalary),

        dateOfPaymentOfWages:
          payment?.status === 'PAID' ? payment.paymentDate : null,

        paidThroughBank:
          payment?.status === 'PAID' &&
          payment.paymentMode === 'BANK_TRANSFER'
            ? snapshot.bankName
            : null,
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.presentDays += employee.presentDays;
        total.halfDays += employee.halfDays;
        total.paidHolidays += employee.paidHolidays;
        total.payableDays += employee.payableDays;

        total.wages += employee.wages;

        total.otHours += employee.otHours;
        total.otAmount += employee.otAmount;

        total.hra += employee.hra;
        total.conveyance += employee.conveyance;
        total.specialAllowance += employee.specialAllowance;
        total.rab += employee.rab;
        total.arrears += employee.arrears;

        total.grossPay += employee.grossPay;

        total.pf += employee.pf;
        total.esic += employee.esic;
        total.ptax += employee.ptax;
        total.mlwf += employee.mlwf;

        total.advance += employee.advance;
        total.canteen += employee.canteen;
        total.uniform += employee.uniform;
        total.fine += employee.fine;
        total.transport += employee.transport;
        total.otherDeduction += employee.otherDeduction;

        total.totalDeduction += employee.totalDeduction;
        total.netWages += employee.netWages;

        return total;
      },
      {
        presentDays: 0,
        halfDays: 0,
        paidHolidays: 0,
        payableDays: 0,

        wages: 0,

        otHours: 0,
        otAmount: 0,

        hra: 0,
        conveyance: 0,
        specialAllowance: 0,
        rab: 0,
        arrears: 0,

        grossPay: 0,

        pf: 0,
        esic: 0,
        ptax: 0,
        mlwf: 0,

        advance: 0,
        canteen: 0,
        uniform: 0,
        fine: 0,
        transport: 0,
        otherDeduction: 0,

        totalDeduction: 0,
        netWages: 0,
      },
    );

    return {
      success: true,
      message: 'Form II Muster Roll Cum Wage Register fetched successfully.',

      data: {
        report: {
          type: 'FORM_II_MUSTER_ROLL_CUM_WAGE_REGISTER',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          daysInMonth,
          employeeCount: employees.length,
        },

        employees,

        totals: {
          presentDays: Number(totals.presentDays.toFixed(1)),
          halfDays: Number(totals.halfDays.toFixed(1)),
          paidHolidays: Number(totals.paidHolidays.toFixed(1)),
          payableDays: Number(totals.payableDays.toFixed(1)),

          wages: this.money(totals.wages),

          otHours: Number(totals.otHours.toFixed(2)),
          otAmount: this.money(totals.otAmount),

          hra: this.money(totals.hra),
          conveyance: this.money(totals.conveyance),
          specialAllowance: this.money(totals.specialAllowance),
          rab: this.money(totals.rab),
          arrears: this.money(totals.arrears),

          grossPay: this.money(totals.grossPay),

          pf: this.money(totals.pf),
          esic: this.money(totals.esic),
          ptax: this.money(totals.ptax),
          mlwf: this.money(totals.mlwf),

          advance: this.money(totals.advance),
          canteen: this.money(totals.canteen),
          uniform: this.money(totals.uniform),
          fine: this.money(totals.fine),
          transport: this.money(totals.transport),
          otherDeduction: this.money(totals.otherDeduction),

          totalDeduction: this.money(totals.totalDeduction),

          netWages: this.money(totals.netWages),
        },
      },
    };
  }

  // =========================================================
  // SALARY REGISTER
  //
  // Company-wide Payroll Report.
  //
  // Source of truth:
  // PayrollEmployeeSnapshot
  //
  // Salary values are taken directly from the persisted
  // payroll snapshot. No payroll calculation is performed
  // by the report module.
  //
  // Payment information is included because Salary Register
  // and Bank Transfer Statement belong to the same report
  // module, but payroll monetary values remain independent
  // from payment status.
  // =========================================================

  async getSalaryRegister(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      return {
        serialNumber: index + 1,

        snapshotId: snapshot.id,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        uanNumber: snapshot.uanNumber,
        esicNumber: snapshot.esicNumber,

        gender: snapshot.gender,
        designation: snapshot.designationName,

        presentDays: Number(snapshot.presentDays),
        halfDays: Number(snapshot.halfDays),
        paidHolidays: Number(snapshot.paidHolidays),
        payableDays: Number(snapshot.payableDays),

        earnings: {
          monthlyBasic: this.money(snapshot.monthlyBasic),
          monthlyDa: this.money(snapshot.monthlyDa),

          earnedBasic: this.money(snapshot.earnedBasic),
          earnedDa: this.money(snapshot.earnedDa),

          wages: this.money(snapshot.wages),

          otHours: Number(snapshot.otHours),
          otRate: this.money(snapshot.otRate),
          otAmount: this.money(snapshot.otAmount),

          hra: this.money(snapshot.hra),
          conveyance: this.money(snapshot.conveyance),

          specialAllowance: this.money(snapshot.specialAllowanceAmount),

          rab: this.money(snapshot.rab),
          arrears: this.money(snapshot.arrears),

          grossSalary: this.money(snapshot.gross),
        },

        deductions: {
          pf: this.money(snapshot.pf),
          esic: this.money(snapshot.esic),
          ptax: this.money(snapshot.ptax),
          mlwf: this.money(snapshot.mlwf),

          advance: this.money(snapshot.advanceRecovery),
          canteen: this.money(snapshot.canteen),
          transport: this.money(snapshot.transport),
          uniform: this.money(snapshot.uniformRecovery),
          fine: this.money(snapshot.fine),
          other: this.money(snapshot.otherDeduction),

          statutoryTotal: this.money(snapshot.statutoryDeductionTotal),

          manualTotal: this.money(snapshot.manualDeductionTotal),

          totalDeduction: this.money(snapshot.totalDeductions),
        },

        netSalary: this.money(snapshot.netSalary),

        payment: {
          status: snapshot.payment?.status ?? 'UNPAID',
          paymentDate: snapshot.payment?.paymentDate ?? null,
          paymentMode: snapshot.payment?.paymentMode ?? null,
        },
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.monthlyBasic += employee.earnings.monthlyBasic;
        total.monthlyDa += employee.earnings.monthlyDa;

        total.earnedBasic += employee.earnings.earnedBasic;
        total.earnedDa += employee.earnings.earnedDa;

        total.wages += employee.earnings.wages;

        total.otHours += employee.earnings.otHours;
        total.otAmount += employee.earnings.otAmount;

        total.hra += employee.earnings.hra;
        total.conveyance += employee.earnings.conveyance;
        total.specialAllowance += employee.earnings.specialAllowance;
        total.rab += employee.earnings.rab;
        total.arrears += employee.earnings.arrears;

        total.grossSalary += employee.earnings.grossSalary;

        total.pf += employee.deductions.pf;
        total.esic += employee.deductions.esic;
        total.ptax += employee.deductions.ptax;
        total.mlwf += employee.deductions.mlwf;

        total.advance += employee.deductions.advance;
        total.canteen += employee.deductions.canteen;
        total.transport += employee.deductions.transport;
        total.uniform += employee.deductions.uniform;
        total.fine += employee.deductions.fine;
        total.other += employee.deductions.other;

        total.statutoryTotal += employee.deductions.statutoryTotal;

        total.manualTotal += employee.deductions.manualTotal;

        total.totalDeduction += employee.deductions.totalDeduction;

        total.netSalary += employee.netSalary;

        return total;
      },
      {
        monthlyBasic: 0,
        monthlyDa: 0,

        earnedBasic: 0,
        earnedDa: 0,

        wages: 0,

        otHours: 0,
        otAmount: 0,

        hra: 0,
        conveyance: 0,
        specialAllowance: 0,
        rab: 0,
        arrears: 0,

        grossSalary: 0,

        pf: 0,
        esic: 0,
        ptax: 0,
        mlwf: 0,

        advance: 0,
        canteen: 0,
        transport: 0,
        uniform: 0,
        fine: 0,
        other: 0,

        statutoryTotal: 0,
        manualTotal: 0,
        totalDeduction: 0,

        netSalary: 0,
      },
    );

    return {
      success: true,
      message: 'Salary Register report fetched successfully.',

      data: {
        report: {
          type: 'SALARY_REGISTER',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          monthlyBasic: this.money(totals.monthlyBasic),
          monthlyDa: this.money(totals.monthlyDa),

          earnedBasic: this.money(totals.earnedBasic),
          earnedDa: this.money(totals.earnedDa),

          wages: this.money(totals.wages),

          otHours: Number(totals.otHours.toFixed(2)),
          otAmount: this.money(totals.otAmount),

          hra: this.money(totals.hra),
          conveyance: this.money(totals.conveyance),

          specialAllowance: this.money(totals.specialAllowance),

          rab: this.money(totals.rab),
          arrears: this.money(totals.arrears),

          grossSalary: this.money(totals.grossSalary),

          pf: this.money(totals.pf),
          esic: this.money(totals.esic),
          ptax: this.money(totals.ptax),
          mlwf: this.money(totals.mlwf),

          advance: this.money(totals.advance),
          canteen: this.money(totals.canteen),
          transport: this.money(totals.transport),
          uniform: this.money(totals.uniform),
          fine: this.money(totals.fine),
          other: this.money(totals.other),

          statutoryTotal: this.money(totals.statutoryTotal),
          manualTotal: this.money(totals.manualTotal),

          totalDeduction: this.money(totals.totalDeduction),

          netSalary: this.money(totals.netSalary),
        },
      },
    };
  }

  // =========================================================
  // BANK TRANSFER STATEMENT
  //
  // Company-wide payment-focused Payroll Report.
  //
  // Historical bank details come from:
  // PayrollEmployeeSnapshot
  //
  // This is intentional. Future changes to Employee Master
  // bank details must not alter an already finalized payroll
  // statement.
  //
  // Net Salary comes directly from the same finalized payroll
  // snapshot used by Salary Register.
  //
  // No payment row means:
  // UNPAID / null date / null mode.
  // =========================================================

  async getBankTransferStatement(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => ({
      serialNumber: index + 1,

      snapshotId: snapshot.id,

      employeeId: snapshot.employeeId,
      employeeName: snapshot.employeeName,

      bankDetails: {
        accountHolderName: snapshot.accountHolderName,
        bankName: snapshot.bankName,
        bankBranch: snapshot.bankBranch,
        ifscCode: snapshot.ifscCode,
        accountNumber: snapshot.accountNumber,
      },

      netSalary: this.money(snapshot.netSalary),

      payment: {
        status: snapshot.payment?.status ?? 'UNPAID',
        paymentDate: snapshot.payment?.paymentDate ?? null,
        paymentMode: snapshot.payment?.paymentMode ?? null,
      },
    }));

    const totalNetSalary = employees.reduce(
      (total, employee) => total + employee.netSalary,
      0,
    );

    const paidEmployees = employees.filter(
      (employee) => employee.payment.status === 'PAID',
    );

    const unpaidEmployees = employees.filter(
      (employee) => employee.payment.status === 'UNPAID',
    );

    const paidAmount = paidEmployees.reduce(
      (total, employee) => total + employee.netSalary,
      0,
    );

    const unpaidAmount = unpaidEmployees.reduce(
      (total, employee) => total + employee.netSalary,
      0,
    );

    return {
      success: true,
      message: 'Bank Transfer Statement fetched successfully.',

      data: {
        report: {
          type: 'BANK_TRANSFER_STATEMENT',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,

          paidCount: paidEmployees.length,
          unpaidCount: unpaidEmployees.length,
        },

        employees,

        totals: {
          netSalary: this.money(totalNetSalary),
          paidAmount: this.money(paidAmount),
          unpaidAmount: this.money(unpaidAmount),
        },
      },
    };
  }

  // =========================================================
  // PAYSLIP
  //
  // Site-wise Payroll Report.
  //
  // Payroll monetary values come exclusively from the current
  // persisted FINALIZED / UNLOCKED Payroll Employee Snapshot
  // for the selected Site.
  //
  // Historical Site is snapshot.siteName.
  // Current Attendance is not used to determine Payslip Site.
  //
  // RATE PER DAY is Payslip-only:
  //
  // Minimum Wage Rate = Monthly Basic + Monthly DA
  // Rate Per Day = Minimum Wage Rate
  //                + (Minimum Wage Rate * 5%)
  //
  // It intentionally does NOT alter payroll calculation.
  //
  // Current fixed Payslip-only fields:
  // Leave Pay       = 0.00
  // Adjusted Days   = 0.00
  // Other Allowance = 0.00
  // =========================================================
  async getPayslip(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const monthlyBasic = this.money(snapshot.monthlyBasic);
      const monthlyDa = this.money(snapshot.monthlyDa);

      const minimumWageRate = this.money(monthlyBasic + monthlyDa);

      const ratePerDay = this.money(
        (minimumWageRate + minimumWageRate * 0.05) / 26,
      );

      return {
        serialNumber: index + 1,

        snapshotId: snapshot.id,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        gender: snapshot.gender,
        designation: snapshot.designationName,

        siteName: snapshot.siteName,

        uanNumber: snapshot.uanNumber,
        esicNumber: snapshot.esicNumber,

        bankName: snapshot.bankName,
        accountNumber: snapshot.accountNumber,
        joiningDate: snapshot.employee.joiningDate,

        attendance: {
          presentDays: Number(snapshot.presentDays),
          halfDays: Number(snapshot.halfDays),
          paidHolidays: Number(snapshot.paidHolidays),
          payableDays: Number(snapshot.payableDays),
          otHours: Number(snapshot.otHours),

          adjustedDays: 0,
        },

        rates: {
          monthlyBasic,
          monthlyDa,
          minimumWageRate,
          ratePerDay,
          otRate: this.money(snapshot.otRate),
        },

        earnings: {
          earnedBasic: this.money(snapshot.earnedBasic),
          earnedDa: this.money(snapshot.earnedDa),

          wages: this.money(snapshot.wages),

          hra: this.money(snapshot.hra),

          otAmount: this.money(snapshot.otAmount),

          conveyance: this.money(snapshot.conveyance),

          specialAllowance: this.money(snapshot.specialAllowanceAmount),

          rab: this.money(snapshot.rab),
          arrears: this.money(snapshot.arrears),

          leavePay: 0,
          otherAllowance: 0,

          gross: this.money(snapshot.gross),
        },

        deductions: {
          pf: this.money(snapshot.pf),
          esic: this.money(snapshot.esic),
          ptax: this.money(snapshot.ptax),
          mlwf: this.money(snapshot.mlwf),

          advanceRecovery: this.money(snapshot.advanceRecovery),
          canteen: this.money(snapshot.canteen),
          transport: this.money(snapshot.transport),
          uniformRecovery: this.money(snapshot.uniformRecovery),
          fine: this.money(snapshot.fine),
          otherDeduction: this.money(snapshot.otherDeduction),

          totalDeductions: this.money(snapshot.totalDeductions),
        },

        netSalary: this.money(snapshot.netSalary),
      };
    });

    return {
      success: true,
      message: 'Payslip fetched successfully.',

      data: {
        report: {
          type: 'PAYSLIP',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,
      },
    };
  }

  // =========================================================
  // HRA REGISTER - FORM A
  //
  // Register of House Rent Allowance.
  //
  // Company-wide Payroll Report.
  //
  // Source of truth:
  // PayrollEmployeeSnapshot
  //
  // Wages:
  // snapshot.wages
  //
  // House Rent:
  // snapshot.hra
  //
  // Monetary values are NOT recalculated from current Wage
  // Master, Attendance or Employee Master.
  //
  // Mode of Payment comes from the optional Payroll Payment
  // record. No payment row means UNPAID and therefore no mode
  // of payment is shown.
  //
  // Signature and Remarks are report-display fields only and
  // remain blank for now.
  // =========================================================

  async getHraRegister(siteId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    await this.getSiteOrThrow(siteId);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
        siteId,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const paymentStatus = snapshot.payment?.status ?? 'UNPAID';

      return {
        serialNumber: index + 1,

        snapshotId: snapshot.id,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        wages: this.money(snapshot.wages),

        houseRentAllowance: this.money(snapshot.hra),

        payment: {
          status: paymentStatus,

          modeOfPayment:
            paymentStatus === 'PAID'
              ? (snapshot.payment?.paymentMode ?? null)
              : null,
        },

        signatureOfWorkman: null,
        remarks: null,
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.wages += employee.wages;
        total.houseRentAllowance += employee.houseRentAllowance;

        return total;
      },
      {
        wages: 0,
        houseRentAllowance: 0,
      },
    );

    return {
      success: true,
      message: 'HRA Register fetched successfully.',

      data: {
        report: {
          type: 'HRA_REGISTER_FORM_A',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          wages: this.money(totals.wages),

          houseRentAllowance: this.money(totals.houseRentAllowance),
        },
      },
    };
  }
  // =========================================================
  // FORM XIII - REGISTER OF ADVANCES
  //
  // Company-wide statutory Deduction Report.
  //
  // Sources:
  // - PayrollEmployeeSnapshot:
  //     historical payroll earnings / designation
  //
  // - Manual Deduction monthly advance ledger:
  //     Old Advance
  //     New Advance
  //     Remaining Installments
  //     Actual Advance Deduction
  //     Closing / Pending Advance
  //
  // The advance ledger calculation is NOT duplicated here.
  // It is obtained from ManualDeductionService.findMonthlySheet().
  //
  // Locked report rules:
  // - Purpose of Advance = blank
  // - Amount repaid = Actual Advance Deduction
  // - "Date on which Total Amount Paid" column displays the
  //   pending advance balance as per approved SISPL format
  // - Signature / Thumb Impression = BANK TRANSFER
  // =========================================================

  async getRegisterOfAdvances(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const [payrollRun, advanceRows] = await Promise.all([
      this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
      ),

      this.manualDeductionService.findMonthlySheet(salaryMonth.toISOString()),
    ]);

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const snapshotByEmployeeId = new Map(
      payrollRun.snapshots.map((snapshot) => [snapshot.employeeId, snapshot]),
    );

    const reportAdvanceRows = advanceRows.filter(
      (row) =>
        row.oldAdvance > 0 || row.newAdvance > 0 || row.closingAdvance > 0,
    );

    const employees = reportAdvanceRows.map((advanceRow, index) => {
      const snapshot = snapshotByEmployeeId.get(advanceRow.employeeId);

      return {
        serialNumber: index + 1,

        employeeId: advanceRow.employeeId,
        employeeName: advanceRow.employeeName,

        natureOfEmployment:
          snapshot?.designationName ?? advanceRow.designation ?? null,

        earningDuringWagePeriod: snapshot ? this.money(snapshot.gross) : 0,

        oldAdvance: this.money(advanceRow.oldAdvance),

        newAdvance: this.money(advanceRow.newAdvance),

        purposeOfAdvance: null,

        numberOfInstallments: advanceRow.remainingInstallments,

        actualAdvanceDeduction: this.money(advanceRow.advanceRecovery),

        pendingAdvance: this.money(advanceRow.closingAdvance),

        signatureOrThumbImpression: 'BANK TRANSFER',
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.earningDuringWagePeriod += employee.earningDuringWagePeriod;

        total.oldAdvance += employee.oldAdvance;
        total.newAdvance += employee.newAdvance;

        total.actualAdvanceDeduction += employee.actualAdvanceDeduction;

        total.pendingAdvance += employee.pendingAdvance;

        return total;
      },
      {
        earningDuringWagePeriod: 0,
        oldAdvance: 0,
        newAdvance: 0,
        actualAdvanceDeduction: 0,
        pendingAdvance: 0,
      },
    );

    return {
      success: true,
      message: 'Form XIII Register of Advances fetched successfully.',

      data: {
        report: {
          type: 'FORM_XIII_REGISTER_OF_ADVANCES',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          earningDuringWagePeriod: this.money(totals.earningDuringWagePeriod),

          oldAdvance: this.money(totals.oldAdvance),

          newAdvance: this.money(totals.newAdvance),

          actualAdvanceDeduction: this.money(totals.actualAdvanceDeduction),

          pendingAdvance: this.money(totals.pendingAdvance),
        },
      },
    };
  }
  // =========================================================
  // FORM XVI - REGISTER OF DEDUCTIONS FOR DAMAGES OR LOSS
  //
  // Company-wide statutory Deduction Report.
  //
  // Source of deduction:
  // PayrollEmployeeSnapshot.otherDeduction
  //
  // This intentionally uses the persisted Payroll Snapshot
  // rather than recalculating or reading a mutable current
  // month deduction amount.
  //
  // Locked SISPL report rules:
  // - Only employees with Other Deduction > 0 are included.
  // - Father's / Husband's Name comes from Employee Profile.
  // - Married female -> Husband Name.
  // - Otherwise      -> Father Name.
  // - Number of instalments = always 1.
  // - Unsupported statutory fields remain blank.
  // =========================================================

  async getRegisterOfDamagesOrLoss(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const applicableSnapshots = payrollRun.snapshots.filter(
      (snapshot) => this.money(snapshot.otherDeduction) > 0,
    );

    const employeeIds = applicableSnapshots.map(
      (snapshot) => snapshot.employeeId,
    );

    const employeeDetails =
      await this.payrollReportsRepository.findDeductionReportEmployeeFamilyDetails(
        employeeIds,
      );

    const employeeDetailsById = new Map(
      employeeDetails.map((employee) => [employee.id, employee]),
    );

    const employees = applicableSnapshots.map((snapshot, index) => {
      const employee = employeeDetailsById.get(snapshot.employeeId);

      const isMarriedFemale =
        employee?.gender?.trim().toUpperCase() === 'FEMALE' &&
        employee?.maritalStatus?.trim().toUpperCase() === 'MARRIED';

      const fatherOrHusbandName = isMarriedFemale
        ? (employee?.husbandName ?? null)
        : (employee?.fatherName ?? null);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        fatherOrHusbandName,

        designation: snapshot.designationName,

        particularsOfDamagesOrLoss: null,

        dateOfDamagesOrLoss: null,

        whetherWorkmanShowedCauseAgainstDeduction: null,

        personPresentDuringExplanation: null,

        amountOfDeductionImposed: this.money(snapshot.otherDeduction),

        numberOfInstallments: 1,

        firstInstallmentRecoveryDate: null,

        lastInstallmentRecoveryDate: null,

        remarks: null,

        signatureOfEmployerOrRepresentative: null,
      };
    });

    const totalAmountOfDeductionImposed = employees.reduce(
      (total, employee) => total + employee.amountOfDeductionImposed,
      0,
    );

    return {
      success: true,
      message:
        'Form XVI Register of Deductions for Damages or Loss fetched successfully.',

      data: {
        report: {
          type: 'FORM_XVI_REGISTER_OF_DEDUCTIONS_FOR_DAMAGES_OR_LOSS',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          amountOfDeductionImposed: this.money(totalAmountOfDeductionImposed),
        },
      },
    };
  }
  // =========================================================
  // FORM XVII - REGISTER OF FINES
  //
  // Company-wide statutory Deduction Report.
  //
  // Source of truth:
  // PayrollEmployeeSnapshot
  //
  // Locked SISPL rules:
  // - Only employees with Fine > 0 are included.
  // - Father's / Husband's Name comes from Employee Profile.
  // - Married female -> Husband Name.
  // - Otherwise      -> Father Name.
  // - Department is not used.
  // - Rate of Wages =
  //     (Monthly Basic + Monthly DA) / 26
  // - Fine amount comes directly from snapshot.fine.
  // - Unsupported statutory fields remain blank.
  // =========================================================

  async getRegisterOfFines(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const applicableSnapshots = payrollRun.snapshots.filter(
      (snapshot) => this.money(snapshot.fine) > 0,
    );

    const employeeIds = applicableSnapshots.map(
      (snapshot) => snapshot.employeeId,
    );

    const employeeDetails =
      await this.payrollReportsRepository.findDeductionReportEmployeeFamilyDetails(
        employeeIds,
      );

    const employeeDetailsById = new Map(
      employeeDetails.map((employee) => [employee.id, employee]),
    );

    const employees = applicableSnapshots.map((snapshot, index) => {
      const employee = employeeDetailsById.get(snapshot.employeeId);

      const isMarriedFemale =
        employee?.gender?.trim().toUpperCase() === 'FEMALE' &&
        employee?.maritalStatus?.trim().toUpperCase() === 'MARRIED';

      const fatherOrHusbandName = isMarriedFemale
        ? (employee?.husbandName ?? null)
        : (employee?.fatherName ?? null);

      const monthlyBasic = this.money(snapshot.monthlyBasic);
      const monthlyDa = this.money(snapshot.monthlyDa);

      const rateOfWages = this.money((monthlyBasic + monthlyDa) / 26);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,

        fatherOrHusbandName,

        designation: snapshot.designationName,

        actOrOmissionForFine: null,

        dateOfOffence: null,

        whetherEmployeeShowedCauseAgainstFine: null,

        personPresentDuringExplanation: null,

        rateOfWages,

        amountOfFineImposed: this.money(snapshot.fine),

        dateOfFineRealised: null,

        remarks: null,
      };
    });

    const totalFineAmount = employees.reduce(
      (total, employee) => total + employee.amountOfFineImposed,
      0,
    );

    return {
      success: true,
      message: 'Form XVII Register of Fines fetched successfully.',

      data: {
        report: {
          type: 'FORM_XVII_REGISTER_OF_FINES',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          fineAmount: this.money(totalFineAmount),
        },
      },
    };
  }
  // =========================================================
  // OVERALL DEDUCTION SUMMARY
  //
  // Company-wide internal Deduction Report.
  //
  // Source of truth:
  // Manual Deduction monthly sheet / advance ledger.
  //
  // Locked SISPL rules:
  // - Includes current-month deductions.
  // - Includes carried/pending advance balances.
  // - No Designation column.
  // - No Site / Work Type / Department filtering.
  // - Advance values come from the established advance ledger.
  // =========================================================

  async getOverallDeductionSummary(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const [payrollRun, monthlySheet] = await Promise.all([
      this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
      ),

      this.manualDeductionService.findMonthlySheet(salaryMonth.toISOString()),
    ]);

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    const reportRows = monthlySheet.filter(
      (row) =>
        row.oldAdvance > 0 ||
        row.newAdvance > 0 ||
        row.advanceRecovery > 0 ||
        row.closingAdvance > 0 ||
        row.canteen > 0 ||
        row.transport > 0 ||
        row.uniformRecovery > 0 ||
        row.fine > 0 ||
        row.otherDeduction > 0,
    );

    const employees = reportRows.map((row, index) => ({
      serialNumber: index + 1,

      employeeId: row.employeeId,
      employeeName: row.employeeName,

      oldAdvance: this.money(row.oldAdvance),
      newAdvance: this.money(row.newAdvance),
      totalAdvance: this.money(row.totalAdvance),

      actualAdvanceDeduction: this.money(row.advanceRecovery),

      balanceAdvance: this.money(row.closingAdvance),

      canteen: this.money(row.canteen),
      transport: this.money(row.transport),
      uniform: this.money(row.uniformRecovery),
      fine: this.money(row.fine),
      otherDeduction: this.money(row.otherDeduction),
    }));

    const totals = employees.reduce(
      (result, employee) => {
        result.oldAdvance += employee.oldAdvance;
        result.newAdvance += employee.newAdvance;
        result.totalAdvance += employee.totalAdvance;
        result.actualAdvanceDeduction += employee.actualAdvanceDeduction;
        result.balanceAdvance += employee.balanceAdvance;
        result.canteen += employee.canteen;
        result.transport += employee.transport;
        result.uniform += employee.uniform;
        result.fine += employee.fine;
        result.otherDeduction += employee.otherDeduction;

        return result;
      },
      {
        oldAdvance: 0,
        newAdvance: 0,
        totalAdvance: 0,
        actualAdvanceDeduction: 0,
        balanceAdvance: 0,
        canteen: 0,
        transport: 0,
        uniform: 0,
        fine: 0,
        otherDeduction: 0,
      },
    );

    return {
      success: true,
      message: 'Overall Deduction Summary fetched successfully.',

      data: {
        report: {
          type: 'OVERALL_DEDUCTION_SUMMARY',

          salaryMonth: payrollRun.salaryMonth,

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            status: payrollRun.status,
            finalizedAt: payrollRun.finalizedAt,
            unlockedAt: payrollRun.unlockedAt,
          },

          employeeCount: employees.length,
        },

        employees,

        totals: {
          oldAdvance: this.money(totals.oldAdvance),
          newAdvance: this.money(totals.newAdvance),
          totalAdvance: this.money(totals.totalAdvance),
          actualAdvanceDeduction: this.money(totals.actualAdvanceDeduction),
          balanceAdvance: this.money(totals.balanceAdvance),
          canteen: this.money(totals.canteen),
          transport: this.money(totals.transport),
          uniform: this.money(totals.uniform),
          fine: this.money(totals.fine),
          otherDeduction: this.money(totals.otherDeduction),
        },
      },
    };
  }

  // =========================================================
  // PAYROLL PAYMENT - VALIDATE INPUT
  // =========================================================

  private resolvePaymentValues(
    status: 'UNPAID' | 'PAID',
    paymentDateInput?: string,
    paymentModeInput?: 'BANK_TRANSFER' | 'CHEQUE',
  ) {
    if (status === 'PAID') {
      if (!paymentDateInput) {
        throw new BadRequestException(
          'Payment date is required when payment status is PAID.',
        );
      }

      if (!paymentModeInput) {
        throw new BadRequestException(
          'Payment mode is required when payment status is PAID.',
        );
      }

      const paymentDate = new Date(paymentDateInput);

      if (Number.isNaN(paymentDate.getTime())) {
        throw new BadRequestException('Payment date is invalid.');
      }

      return {
        paymentDate,
        paymentMode: paymentModeInput,
      };
    }

    return {
      paymentDate: null,
      paymentMode: null,
    };
  }

  // =========================================================
  // PAYROLL PAYMENT - VALIDATE SNAPSHOT
  // =========================================================

  private validatePaymentSnapshot(
    snapshot: Awaited<
      ReturnType<PayrollReportsRepository['findPayrollSnapshotPaymentContext']>
    >,
  ) {
    if (!snapshot) {
      throw new NotFoundException('Payroll snapshot not found.');
    }

    if (snapshot.payrollRun.status !== 'FINALIZED') {
      throw new ConflictException(
        'Payment can only be updated for the current finalized Payroll Run.',
      );
    }
  }

  // =========================================================
  // PAYROLL PAYMENT - UPDATE SINGLE
  // =========================================================

  async updatePayrollPayment(
    snapshotId: number,
    status: 'UNPAID' | 'PAID',
    paymentDateInput?: string,
    paymentModeInput?: 'BANK_TRANSFER' | 'CHEQUE',
  ) {
    const snapshot =
      await this.payrollReportsRepository.findPayrollSnapshotPaymentContext(
        snapshotId,
      );

    this.validatePaymentSnapshot(snapshot);

    const currentRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        snapshot!.payrollRun.salaryMonth,
        snapshot!.payrollRun.siteId,
      );

    if (
      !currentRun ||
      currentRun.id !== snapshot!.payrollRun.id ||
      currentRun.status !== 'FINALIZED'
    ) {
      throw new ConflictException(
        'Payment can only be updated for snapshots belonging to the current finalized Payroll Run.',
      );
    }

    const { paymentDate, paymentMode } = this.resolvePaymentValues(
      status,
      paymentDateInput,
      paymentModeInput,
    );

    const payment = await this.payrollReportsRepository.upsertPayrollPayment(
      snapshotId,
      status,
      paymentDate,
      paymentMode,
    );

    return {
      success: true,
      message: 'Payroll payment updated successfully.',
      data: {
        snapshotId,
        employeeId: snapshot!.employeeId,
        employeeName: snapshot!.employeeName,
        netSalary: this.money(snapshot!.netSalary),

        payment: {
          id: payment.id,
          status: payment.status,
          paymentDate: payment.paymentDate,
          paymentMode: payment.paymentMode,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        },
      },
    };
  }

  // =========================================================
  // PAYROLL PAYMENT - BULK UPDATE
  // =========================================================

  async bulkUpdatePayrollPayment(
    snapshotIds: number[],
    status: 'UNPAID' | 'PAID',
    paymentDateInput?: string,
    paymentModeInput?: 'BANK_TRANSFER' | 'CHEQUE',
  ) {
    const uniqueSnapshotIds = [...new Set(snapshotIds)];

    const snapshots =
      await this.payrollReportsRepository.findPayrollSnapshotsPaymentContext(
        uniqueSnapshotIds,
      );

    if (snapshots.length !== uniqueSnapshotIds.length) {
      const foundIds = new Set(snapshots.map((snapshot) => snapshot.id));

      const missingIds = uniqueSnapshotIds.filter(
        (snapshotId) => !foundIds.has(snapshotId),
      );

      throw new NotFoundException(
        `Payroll snapshot(s) not found: ${missingIds.join(', ')}.`,
      );
    }

    if (snapshots.length === 0) {
      throw new BadRequestException(
        'At least one Payroll snapshot is required.',
      );
    }

    const payrollRunId = snapshots[0].payrollRun.id;
    const salaryMonth = snapshots[0].payrollRun.salaryMonth;

    for (const snapshot of snapshots) {
      if (snapshot.payrollRun.status !== 'FINALIZED') {
        throw new ConflictException(
          'Payment can only be updated for the current finalized Payroll Run.',
        );
      }

      if (snapshot.payrollRun.id !== payrollRunId) {
        throw new ConflictException(
          'All selected Payroll snapshots must belong to the same Payroll Run.',
        );
      }
    }

    const currentRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
        snapshots[0].payrollRun.siteId,
      );

    if (
      !currentRun ||
      currentRun.id !== payrollRunId ||
      currentRun.status !== 'FINALIZED'
    ) {
      throw new ConflictException(
        'Payment can only be updated for snapshots belonging to the current finalized Payroll Run.',
      );
    }

    const { paymentDate, paymentMode } = this.resolvePaymentValues(
      status,
      paymentDateInput,
      paymentModeInput,
    );

    const payments = await this.payrollReportsRepository.upsertPayrollPayments(
      uniqueSnapshotIds,
      status,
      paymentDate,
      paymentMode,
    );

    return {
      success: true,
      message: 'Payroll payments updated successfully.',
      data: {
        payrollRunId,
        salaryMonth,
        updatedCount: payments.length,

        payment: {
          status,
          paymentDate,
          paymentMode,
        },

        snapshotIds: uniqueSnapshotIds,
      },
    };
  }
}

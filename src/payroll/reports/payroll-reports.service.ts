import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollReportsRepository } from './repository/payroll-reports.repository';

@Injectable()
export class PayrollReportsService {
  constructor(
    private readonly payrollReportsRepository: PayrollReportsRepository,
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
  // DATE OF PAYMENT and MODE OF PAYMENT are intentionally
  // excluded for now and will be implemented later.
  // =========================================================

  async getWageSheet(salaryMonthInput: Date) {
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
  //
  // Employee Master details are fetched independently from
  // Attendance so an employee with zero Attendance can still
  // show available DOB / DOJ details.
  //
  // No Site / Work Type / Department filtering.
  //
  // Ignored for now:
  // - Leave with Wages BM:BP
  // - Date of Payment
  // - Paid Through Bank
  // =========================================================

  async getFormIi(salaryMonthInput: Date) {
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

    const employeeIds = payrollRun.snapshots.map(
      (snapshot) => snapshot.employeeId,
    );

    const [attendances, employeeDetails] = await Promise.all([
      this.payrollReportsRepository.findFormIiMonthlyAttendance(
        salaryMonth,
        employeeIds,
      ),

      this.payrollReportsRepository.findFormIiEmployeeDetails(employeeIds),
    ]);

    const employeeDetailsById = new Map(
      employeeDetails.map((employee) => [employee.id, employee]),
    );

    const daysInMonth = new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();

    type AttendanceEmployeeContext = {
      attendanceByDay: Map<number, string>;
    };

    const attendanceByEmployee = new Map<number, AttendanceEmployeeContext>();

    for (const attendance of attendances) {
      let employeeContext = attendanceByEmployee.get(attendance.employeeId);

      if (!employeeContext) {
        employeeContext = {
          attendanceByDay: new Map<number, string>(),
        };

        attendanceByEmployee.set(attendance.employeeId, employeeContext);
      }

      const code = this.mapFormIiAttendanceCode(attendance.status);

      if (!code) {
        continue;
      }

      const day = attendance.attendanceDate.getUTCDate();

      /*
       * Same finalized Muster rule:
       *
       * If more than one shift row exists for an employee on
       * the same date, preserve the first valid attendance code
       * returned by the ordered repository query.
       */
      if (!employeeContext.attendanceByDay.has(day)) {
        employeeContext.attendanceByDay.set(day, code);
      }
    }

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const attendanceContext = attendanceByEmployee.get(snapshot.employeeId);

      const employeeDetail = employeeDetailsById.get(snapshot.employeeId);

      const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const day = dayIndex + 1;

        return {
          day,
          code: attendanceContext?.attendanceByDay.get(day) ?? '',
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

  async getSalaryRegister(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
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

  async getBankTransferStatement(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const payrollRun =
      await this.payrollReportsRepository.findCurrentPayrollRunWithSnapshotsAndPayments(
        salaryMonth,
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

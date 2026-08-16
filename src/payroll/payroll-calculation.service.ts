import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollRepository } from './repository/payroll.repository';
import { ComplianceCalculatorService } from './compliance/compliance-calculator.service';

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly complianceCalculator: ComplianceCalculatorService,
  ) {}

  // =========================================================
  // SALARY MONTH
  // =========================================================

  private normalizeSalaryMonth(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth(), 1),
    );
  }

  private getPeriodEndExclusive(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(salaryMonth.getUTCFullYear(), salaryMonth.getUTCMonth() + 1, 1),
    );
  }

  // =========================================================
  // PAYABLE DAYS
  //
  // Locked payroll attendance rules:
  //
  // PRESENT       = 1.0
  // HALF_DAY      = 0.5
  // PAID_HOLIDAY  = 1.0
  //
  // WEEKLY_OFF / HOLIDAY / LEAVE are retained for attendance
  // reports but do not enter payroll payable-day calculation.
  // =========================================================

  private calculateAttendance(
    attendances: {
      status: string;
      otHours: unknown;
    }[],
  ) {
    let presentDays = 0;
    let halfDays = 0;
    let paidHolidays = 0;
    let payableDays = 0;
    let otHours = 0;

    for (const attendance of attendances) {
      switch (attendance.status) {
        case 'PRESENT':
          presentDays += 1;
          payableDays += 1;
          break;

        case 'HALF_DAY':
          halfDays += 1;
          payableDays += 0.5;
          break;

        case 'PAID_HOLIDAY':
          paidHolidays += 1;
          payableDays += 1;
          break;
      }

      otHours += Number(attendance.otHours);
    }

    return {
      presentDays,
      halfDays,
      paidHolidays,
      payableDays,
      otHours,
    };
  }

  // =========================================================
  // SPECIAL ALLOWANCE
  //
  // Option A:
  //
  // Find one matching slab:
  // minDays <= payableDays <= maxDays
  //
  // Special Allowance =
  // payableDays × matched ratePerDay
  //
  // No matching slab = 0.
  // =========================================================

  private calculateSpecialAllowance(
    payableDays: number,
    slabs: {
      minDays: unknown;
      maxDays: unknown;
      ratePerDay: unknown;
    }[],
  ) {
    const matchedSlab = slabs.find(
      (slab) =>
        payableDays >= Number(slab.minDays) &&
        payableDays <= Number(slab.maxDays),
    );

    if (!matchedSlab) {
      return {
        ratePerDay: 0,
        amount: 0,
        slab: null,
      };
    }

    const ratePerDay = Number(matchedSlab.ratePerDay);

    return {
      ratePerDay,
      amount: payableDays * ratePerDay,
      slab: {
        minDays: Number(matchedSlab.minDays),
        maxDays: Number(matchedSlab.maxDays),
      },
    };
  }

  // =========================================================
  // EMPLOYEE PAYROLL CALCULATION
  // =========================================================

  async calculateEmployee(employeeId: number, salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const employee = await this.payrollRepository.findEmployeeById(employeeId);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    const wageMaster = await this.payrollRepository.findApplicableWageMaster(
      employee.designationId,
      salaryMonth,
    );

    if (!wageMaster) {
      throw new NotFoundException(
        `No applicable Wage Master found for employee ${employeeId} for the selected salary month.`,
      );
    }

    const [attendances, variableAllowance, manualDeduction] = await Promise.all(
      [
        this.payrollRepository.findMonthlyAttendance(
          employeeId,
          salaryMonth,
          periodEndExclusive,
        ),

        this.payrollRepository.findVariableAllowance(employeeId, salaryMonth),

        this.payrollRepository.findManualDeduction(employeeId, salaryMonth),
      ],
    );

    // =======================================================
    // ATTENDANCE
    // =======================================================

    const attendance = this.calculateAttendance(attendances);

    // =======================================================
    // WAGE MASTER VALUES
    // =======================================================

    const monthlyBasic = Number(wageMaster.basic);
    const monthlyDa = Number(wageMaster.da);
    const hraPercentage = Number(wageMaster.hraPercentage);

    // =======================================================
    // EARNED BASIC / DA
    //
    // Locked 26-day basis.
    // =======================================================

    const earnedBasic = (monthlyBasic / 26) * attendance.payableDays;
    const earnedDa = (monthlyDa / 26) * attendance.payableDays;

    const wages = earnedBasic + earnedDa;

    // =======================================================
    // HRA
    // =======================================================

    const hra = wages * (hraPercentage / 100);

    // =======================================================
    // OT OPTION A
    //
    // OT Rate =
    // ((Basic + DA) / 26 / 8 × 2) + 5%
    //
    // Equivalent:
    // ((Basic + DA) / 26 / 8 × 2) × 1.05
    // =======================================================

    const baseOtRate = ((monthlyBasic + monthlyDa) / 26 / 8) * 2;

    const otRate = baseOtRate * 1.05;

    const otAmount = otRate * attendance.otHours;

    // =======================================================
    // SPECIAL ALLOWANCE
    // =======================================================

    const specialAllowance = this.calculateSpecialAllowance(
      attendance.payableDays,
      wageMaster.specialAllowances,
    );

    // =======================================================
    // VARIABLE ALLOWANCES
    // =======================================================

    const conveyance = variableAllowance
      ? Number(variableAllowance.conveyance)
      : 0;

    const arrears = variableAllowance ? Number(variableAllowance.arrears) : 0;

    const rab = variableAllowance ? Number(variableAllowance.rab) : 0;

    // =======================================================
    // GROSS
    //
    // Gross =
    // Wages
    // + OT Amount
    // + HRA
    // + Conveyance
    // + Special Allowance
    // + RAB
    // + Arrears
    // =======================================================

    const gross =
      wages +
      otAmount +
      hra +
      conveyance +
      specialAllowance.amount +
      rab +
      arrears;

    // =======================================================
    // COMPLIANCE
    // =======================================================

    const pf = this.complianceCalculator.calculatePf(earnedBasic, earnedDa);

    const esic = this.complianceCalculator.calculateEsic(
      gross,
      conveyance,
      specialAllowance.amount,
    );

    if (!employee.gender) {
      throw new BadRequestException(
        `Gender is required for PTax calculation for employee ${employeeId}.`,
      );
    }

    const ptax = this.complianceCalculator.calculatePtax(
      gross,
      employee.gender,
      salaryMonth,
    );

    const mlwf = this.complianceCalculator.calculateMlwf(salaryMonth);

    // =======================================================
    // MANUAL DEDUCTIONS
    // =======================================================

    const advanceRecovery = manualDeduction
      ? Number(manualDeduction.advanceRecovery)
      : 0;

    const canteen = manualDeduction ? Number(manualDeduction.canteen) : 0;

    const transport = manualDeduction ? Number(manualDeduction.transport) : 0;

    const uniformRecovery = manualDeduction
      ? Number(manualDeduction.uniformRecovery)
      : 0;

    const fine = manualDeduction ? Number(manualDeduction.fine) : 0;

    const otherDeduction = manualDeduction
      ? Number(manualDeduction.otherDeduction)
      : 0;

    const manualDeductionTotal =
      advanceRecovery +
      canteen +
      transport +
      uniformRecovery +
      fine +
      otherDeduction;

    // =======================================================
    // TOTAL DEDUCTIONS / NET SALARY
    // =======================================================

    const statutoryDeductionTotal = pf + esic + ptax + mlwf;

    const totalDeductions = statutoryDeductionTotal + manualDeductionTotal;

    const netSalary = gross - totalDeductions;

    const warnings: string[] = [];

    if (netSalary < 0) {
      warnings.push('Net salary is negative.');
    }

    // =======================================================
    // PREVIEW RESULT
    //
    // No database write occurs here.
    // No rounding is applied.
    // =======================================================

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        gender: employee.gender,

        designation: {
          id: employee.designation.id,
          designationName: employee.designation.designationName,
        },

        site: {
          id: employee.designation.site.id,
          siteName: employee.designation.site.siteName,
        },
      },

      salaryMonth: salaryMonth.toISOString(),

      wageMaster: {
        id: wageMaster.id,
        version: wageMaster.version,
        effectiveFrom: wageMaster.effectiveFrom,
        effectiveTo: wageMaster.effectiveTo,
      },

      attendance,

      earnings: {
        monthlyBasic,
        monthlyDa,

        earnedBasic,
        earnedDa,
        wages,

        hraPercentage,
        hra,

        otRate,
        otHours: attendance.otHours,
        otAmount,

        conveyance,

        specialAllowance: {
          ratePerDay: specialAllowance.ratePerDay,
          amount: specialAllowance.amount,
          slab: specialAllowance.slab,
        },

        rab,
        arrears,

        gross,
      },

      statutoryDeductions: {
        pf,
        esic,
        ptax,
        mlwf,
        total: statutoryDeductionTotal,
      },

      manualDeductions: {
        advanceRecovery,
        canteen,
        transport,
        uniformRecovery,
        fine,
        otherDeduction,
        total: manualDeductionTotal,
      },

      totalDeductions,

      netSalary,

      warnings,
    };
  }
  // =========================================================
  // COMPANY-WIDE MONTHLY PAYROLL PREVIEW
  //
  // One company-wide payroll for the selected salary month.
  //
  // A validation problem for one employee does not prevent
  // other employees from being previewed.
  // =========================================================

  async calculateMonthlyPreview(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const employees = await this.payrollRepository.findMonthlyPayrollEmployees(
      salaryMonth,
      periodEndExclusive,
    );

    const payrolls: Awaited<ReturnType<typeof this.calculateEmployee>>[] = [];

    const errors: {
      employeeId: number;
      employeeName: string;
      message: string;
    }[] = [];

    for (const employee of employees) {
      try {
        const payroll = await this.calculateEmployee(employee.id, salaryMonth);

        payrolls.push(payroll);
      } catch (error) {
        errors.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          message:
            error instanceof Error
              ? error.message
              : 'Payroll calculation failed.',
        });
      }
    }

    const summary = payrolls.reduce(
      (total, payroll) => {
        total.gross += payroll.earnings.gross;

        total.pf += payroll.statutoryDeductions.pf;
        total.esic += payroll.statutoryDeductions.esic;
        total.ptax += payroll.statutoryDeductions.ptax;
        total.mlwf += payroll.statutoryDeductions.mlwf;

        total.manualDeductions += payroll.manualDeductions.total;

        total.totalDeductions += payroll.totalDeductions;
        total.netSalary += payroll.netSalary;

        return total;
      },
      {
        gross: 0,
        pf: 0,
        esic: 0,
        ptax: 0,
        mlwf: 0,
        manualDeductions: 0,
        totalDeductions: 0,
        netSalary: 0,
      },
    );

    return {
      salaryMonth: salaryMonth.toISOString(),

      employeeCount: employees.length,

      processedCount: payrolls.length,

      errorCount: errors.length,

      payrolls,

      summary,

      errors,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PayrollRepository } from './repository/payroll.repository';
import { ComplianceCalculatorService } from './compliance/compliance-calculator.service';

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly complianceCalculator: ComplianceCalculatorService,
  ) {}

  private readonly payrollAttendanceStatuses =
    new Set<AttendanceStatus>([
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PAID_HOLIDAY,
    ]);

  // =========================================================
  // SALARY MONTH
  // =========================================================

  private normalizeSalaryMonth(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(
        salaryMonth.getUTCFullYear(),
        salaryMonth.getUTCMonth(),
        1,
      ),
    );
  }

  private getPeriodEndExclusive(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(
        salaryMonth.getUTCFullYear(),
        salaryMonth.getUTCMonth() + 1,
        1,
      ),
    );
  }

  private roundToTwoDecimals(value: number): number {
    return Number(value.toFixed(2));
  }

  // =========================================================
  // SITE VALIDATION
  // =========================================================

  private async validateSiteExists(siteId: number) {
    const site = await this.payrollRepository.findSiteById(siteId);

    if (!site) {
      throw new NotFoundException(
        `Site with ID ${siteId} not found.`,
      );
    }

    return site;
  }

  // =========================================================
  // EMPLOYEE MONTHLY PAYROLL SITE
  //
  // Locked rule:
  //
  // One employee may belong to only ONE payroll Site in one
  // salary month.
  //
  // All Attendance Site contexts participate in conflict
  // detection.
  //
  // Daily OT Site contexts also participate in conflict
  // detection.
  //
  // Payroll-relevant Attendance with no Site is invalid.
  //
  // Positive Daily OT with no Site is invalid.
  // =========================================================

  private async resolveEmployeePayrollSite(
    employeeId: number,
    selectedSiteId: number,
    salaryMonth: Date,
    periodEndExclusive: Date,
  ) {
    const [attendanceRows, otAttendanceRows] =
      await Promise.all([
        this.payrollRepository.findMonthlyAttendanceSiteRows(
          employeeId,
          salaryMonth,
          periodEndExclusive,
        ),

        this.payrollRepository.findMonthlyOtAttendanceSiteRows(
          employeeId,
          salaryMonth,
          periodEndExclusive,
        ),
      ]);

    const siteMap = new Map<
      number,
      {
        id: number;
        siteName: string;
      }
    >();

    let hasPayrollRelevantAttendance = false;

    for (const attendance of attendanceRows) {
      const site =
        attendance.department?.workType.site ?? null;

      const isPayrollRelevant =
        this.payrollAttendanceStatuses.has(attendance.status);

      if (isPayrollRelevant) {
        hasPayrollRelevantAttendance = true;

        if (!site) {
          throw new ConflictException(
            `Employee ${employeeId} has payroll-relevant Attendance without a valid Site for ${salaryMonth.toISOString()}. Correct Attendance before payroll processing.`,
          );
        }
      }

      if (site) {
        siteMap.set(site.id, {
          id: site.id,
          siteName: site.siteName,
        });
      }
    }

    for (const otAttendance of otAttendanceRows) {
      const site =
        otAttendance.department?.workType.site ?? null;

      const otHours = Number(otAttendance.otHours);

      if (otHours > 0 && !site) {
        throw new ConflictException(
          `Employee ${employeeId} has Daily OT without a valid Site for ${salaryMonth.toISOString()}. Correct Daily OT before payroll processing.`,
        );
      }

      if (site) {
        siteMap.set(site.id, {
          id: site.id,
          siteName: site.siteName,
        });
      }
    }

    if (siteMap.size > 1) {
      const sites = Array.from(siteMap.values())
        .map((site) => `${site.id} - ${site.siteName}`)
        .join(', ');

      throw new ConflictException(
        `Employee ${employeeId} has Attendance/OT under multiple Sites for ${salaryMonth.toISOString()}: ${sites}. Correct Attendance/OT before payroll processing.`,
      );
    }

    if (!hasPayrollRelevantAttendance) {
      throw new ConflictException(
        `Employee ${employeeId} has no payroll-relevant Attendance for ${salaryMonth.toISOString()}.`,
      );
    }

    const resolvedSite =
      siteMap.size === 1
        ? Array.from(siteMap.values())[0]
        : null;

    if (!resolvedSite) {
      throw new ConflictException(
        `Payroll Site could not be resolved for employee ${employeeId} for ${salaryMonth.toISOString()}.`,
      );
    }

    if (resolvedSite.id !== selectedSiteId) {
      throw new ConflictException(
        `Employee ${employeeId} belongs to Site ${resolvedSite.id} - ${resolvedSite.siteName} for ${salaryMonth.toISOString()}, not selected Site ${selectedSiteId}.`,
      );
    }

    return resolvedSite;
  }

  // =========================================================
  // PAYABLE DAYS
  //
  // LOCKED:
  //
  // PRESENT       = 1.0
  // HALF_DAY      = 0.5
  // PAID_HOLIDAY  = 1.0
  //
  // WEEKLY_OFF / HOLIDAY / LEAVE do not enter payroll
  // payable-day calculation.
  // =========================================================

  private calculateAttendance(
    attendances: {
      status: string;
    }[],
    otAttendances: {
      otHours: unknown;
    }[],
  ) {
    let presentDays = 0;
    let halfDays = 0;
    let paidHolidays = 0;
    let payableDays = 0;

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
    }

    // =======================================================
    // MANUAL OT
    //
    // OT is sourced only from Daily OT Attendance.
    //
    // Multiple legitimate shifts are summed independently.
    // =======================================================

    const otHours = otAttendances.reduce(
      (total, otAttendance) =>
        total + Number(otAttendance.otHours),
      0,
    );

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
  // Existing locked slab calculation remains unchanged.
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
  // PUBLIC SINGLE EMPLOYEE PAYROLL
  // =========================================================

  async calculateEmployee(
    employeeId: number,
    siteId: number,
    salaryMonthInput: Date,
  ) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException(
        'Salary month is invalid.',
      );
    }

    const selectedSite =
      await this.validateSiteExists(siteId);

    return this.calculateEmployeeForSite(
      employeeId,
      selectedSite,
      salaryMonthInput,
    );
  }

  // =========================================================
  // INTERNAL EMPLOYEE PAYROLL
  //
  // Site has already been validated before calculation.
  // =========================================================

  private async calculateEmployeeForSite(
    employeeId: number,
    selectedSite: {
      id: number;
      siteName: string;
    },
    salaryMonthInput: Date,
  ) {
    const salaryMonth =
      this.normalizeSalaryMonth(salaryMonthInput);

    const periodEndExclusive =
      this.getPeriodEndExclusive(salaryMonth);

    const employee =
      await this.payrollRepository.findEmployeeById(employeeId);

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${employeeId} not found.`,
      );
    }

    const resolvedSite =
      await this.resolveEmployeePayrollSite(
        employeeId,
        selectedSite.id,
        salaryMonth,
        periodEndExclusive,
      );

    const wageMaster =
      await this.payrollRepository.findApplicableWageMaster(
        employee.designationId,
        salaryMonth,
      );

    if (!wageMaster) {
      throw new NotFoundException(
        `No applicable Wage Master found for employee ${employeeId} for the selected salary month.`,
      );
    }

    const [
      attendances,
      otAttendances,
      variableAllowance,
      manualDeduction,
    ] = await Promise.all([
      this.payrollRepository.findMonthlyAttendance(
        employeeId,
        selectedSite.id,
        salaryMonth,
        periodEndExclusive,
      ),

      this.payrollRepository.findMonthlyOtAttendance(
        employeeId,
        selectedSite.id,
        salaryMonth,
        periodEndExclusive,
      ),

      this.payrollRepository.findVariableAllowance(
        employeeId,
        salaryMonth,
      ),

      this.payrollRepository.findManualDeduction(
        employeeId,
        salaryMonth,
      ),
    ]);

    // =======================================================
    // VARIABLE ALLOWANCE SITE OWNERSHIP
    // =======================================================

    if (variableAllowance) {
      if (variableAllowance.siteId === null) {
        throw new ConflictException(
          `Variable Allowance for employee ${employeeId} for ${salaryMonth.toISOString()} has no resolved Site. Correct the legacy Variable Allowance before payroll processing.`,
        );
      }

      if (variableAllowance.siteId !== selectedSite.id) {
        throw new ConflictException(
          `Variable Allowance for employee ${employeeId} for ${salaryMonth.toISOString()} belongs to Site ${variableAllowance.siteId}, not selected Site ${selectedSite.id}.`,
        );
      }
    }

    // =======================================================
    // MANUAL DEDUCTION SITE OWNERSHIP
    // =======================================================

    if (manualDeduction) {
      if (manualDeduction.siteId === null) {
        throw new ConflictException(
          `Manual Deduction for employee ${employeeId} for ${salaryMonth.toISOString()} has no resolved Site. Correct the legacy Manual Deduction before payroll processing.`,
        );
      }

      if (manualDeduction.siteId !== selectedSite.id) {
        throw new ConflictException(
          `Manual Deduction for employee ${employeeId} for ${salaryMonth.toISOString()} belongs to Site ${manualDeduction.siteId}, not selected Site ${selectedSite.id}.`,
        );
      }
    }

    // =======================================================
    // ATTENDANCE
    // =======================================================

    const attendance = this.calculateAttendance(
      attendances,
      otAttendances,
    );

    // =======================================================
    // WAGE MASTER VALUES
    // =======================================================

    const monthlyBasic = Number(wageMaster.basic);
    const monthlyDa = Number(wageMaster.da);

    const hraPercentage =
      Number(wageMaster.hraPercentage);

    // =======================================================
    // EARNED BASIC / DA
    //
    // LOCKED 26-DAY BASIS.
    //
    // Daily Minimum Wage Rate =
    // ROUND((Monthly Basic + Monthly DA) / 26, 2)
    //
    // Earned Basic / DA remain proportionately split so:
    //
    // Earned Basic + Earned DA = Wages
    // =======================================================

    const monthlyWages = monthlyBasic + monthlyDa;

    const dailyWageRate =
      this.roundToTwoDecimals(monthlyWages / 26);

    const wages =
      dailyWageRate * attendance.payableDays;

    const earnedBasic =
      monthlyWages > 0
        ? wages * (monthlyBasic / monthlyWages)
        : 0;

    const earnedDa = wages - earnedBasic;

    // =======================================================
    // HRA
    // =======================================================

    const hra =
      wages * (hraPercentage / 100);

    // =======================================================
    // OT OPTION A
    //
    // Existing locked OT formula:
    //
    // (Daily Wage Rate / 8 x 2) x 1.05
    // =======================================================

    const baseOtRate =
      (dailyWageRate / 8) * 2;

    const otRate =
      baseOtRate * 1.05;

    const otAmount =
      otRate * attendance.otHours;

    // =======================================================
    // SPECIAL ALLOWANCE
    // =======================================================

    const specialAllowance =
      this.calculateSpecialAllowance(
        attendance.payableDays,
        wageMaster.specialAllowances,
      );

    // =======================================================
    // VARIABLE ALLOWANCES
    // =======================================================

    const conveyance = variableAllowance
      ? Number(variableAllowance.conveyance)
      : 0;

    const arrears = variableAllowance
      ? Number(variableAllowance.arrears)
      : 0;

    const rab = variableAllowance
      ? Number(variableAllowance.rab)
      : 0;

    // =======================================================
    // GROSS
    //
    // Existing formula remains unchanged.
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

    const pf =
      this.complianceCalculator.calculatePf(
        earnedBasic,
        earnedDa,
      );

    const esic =
      this.complianceCalculator.calculateEsic(
        gross,
        conveyance,
        specialAllowance.amount,
      );

    if (!employee.gender) {
      throw new BadRequestException(
        `Gender is required for PTax calculation for employee ${employeeId}.`,
      );
    }

    const ptax =
      this.complianceCalculator.calculatePtax(
        gross,
        employee.gender,
        salaryMonth,
      );

    const mlwf =
      employee.designation.designationName.trim().toUpperCase() === 'SUPERVISOR'
        ? 0
        : this.complianceCalculator.calculateMlwf(
            salaryMonth,
          );

    // =======================================================
    // MANUAL DEDUCTIONS
    // =======================================================

    const advanceRecovery = manualDeduction
      ? Number(manualDeduction.advanceRecovery)
      : 0;

    const canteen = manualDeduction
      ? Number(manualDeduction.canteen)
      : 0;

    const transport = manualDeduction
      ? Number(manualDeduction.transport)
      : 0;

    const uniformRecovery = manualDeduction
      ? Number(manualDeduction.uniformRecovery)
      : 0;

    const fine = manualDeduction
      ? Number(manualDeduction.fine)
      : 0;

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

    const statutoryDeductionTotal =
      pf + esic + ptax + mlwf;

    const totalDeductions =
      statutoryDeductionTotal +
      manualDeductionTotal;

    const netSalary =
      gross - totalDeductions;

    const warnings: string[] = [];

    if (netSalary < 0) {
      warnings.push('Net salary is negative.');
    }

    // =======================================================
    // PREVIEW RESULT
    //
    // No database write occurs here.
    //
    // Only the locked Daily Minimum Wage Rate is rounded to
    // 2 decimal places before downstream wage calculations.
    // =======================================================

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        gender: employee.gender,

        bankName: employee.bankName,
        bankBranch: employee.bankBranch,
        accountHolderName: employee.accountHolderName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        uanNumber: employee.uanNumber,
        esicNumber: employee.esicNumber,

        designation: {
          id: employee.designation.id,
          designationName:
            employee.designation.designationName,
        },

        site: {
          id: resolvedSite.id,
          siteName: resolvedSite.siteName,
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
  // SITE-WISE MONTHLY PAYROLL PREVIEW
  //
  // A validation problem for one employee does not prevent
  // other employees from being previewed.
  //
  // Finalization remains blocked while any preview error
  // exists.
  // =========================================================

  async calculateMonthlyPreview(
    siteId: number,
    salaryMonthInput: Date,
  ) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException(
        'Salary month is invalid.',
      );
    }

    const selectedSite =
      await this.validateSiteExists(siteId);

    const salaryMonth =
      this.normalizeSalaryMonth(salaryMonthInput);

    const periodEndExclusive =
      this.getPeriodEndExclusive(salaryMonth);

    const employees =
      await this.payrollRepository.findMonthlyPayrollEmployees(
        selectedSite.id,
        salaryMonth,
        periodEndExclusive,
      );

    const payrolls: Awaited<
      ReturnType<typeof this.calculateEmployee>
    >[] = [];

    const errors: {
      employeeId: number;
      employeeName: string;
      message: string;
    }[] = [];

    for (const employee of employees) {
      try {
        const payroll =
          await this.calculateEmployeeForSite(
            employee.id,
            selectedSite,
            salaryMonth,
          );

        payrolls.push(payroll);
      } catch (error) {
        errors.push({
          employeeId: employee.id,

          employeeName:
            `${employee.firstName} ${employee.lastName}`.trim(),

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

        total.manualDeductions +=
          payroll.manualDeductions.total;

        total.totalDeductions +=
          payroll.totalDeductions;

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
      site: {
        id: selectedSite.id,
        siteName: selectedSite.siteName,
      },

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
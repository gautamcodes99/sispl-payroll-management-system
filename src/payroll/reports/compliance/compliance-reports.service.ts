import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplianceReportsRepository } from './repository/compliance-reports.repository';

@Injectable()
export class ComplianceReportsService {
  constructor(
    private readonly complianceReportsRepository: ComplianceReportsRepository,
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
  // Compliance report monetary output is standardized to
  // 2 decimal places.
  //
  // Payroll values themselves come from persisted
  // PayrollEmployeeSnapshot values.
  // =========================================================

  private money(value: unknown): number {
    return Number(Number(value ?? 0).toFixed(2));
  }

  // =========================================================
  // CURRENT PAYROLL RUN
  // =========================================================

  private async getCurrentPayrollRun(
    siteId: number,
    salaryMonthInput: Date,
  ) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const site =
      await this.complianceReportsRepository.findSiteById(siteId);

    if (!site) {
      throw new NotFoundException(
        `Site with ID ${siteId} not found.`,
      );
    }

    const payrollRun =
      await this.complianceReportsRepository.findCurrentPayrollRunWithSnapshots(
        siteId,
        salaryMonth,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current finalized Payroll Run found for Site ${siteId} and ${salaryMonth.toISOString()}.`,
      );
    }

    return {
      site,
      salaryMonth,
      payrollRun,
    };
  }

  // =========================================================
  // PF ANNEXURE
  //
  // Approved mapping:
  //
  // A SNO
  // B EMP ID
  // C UAN
  // D EMP NAME
  // E DAYS
  // F GROSS PAY
  // G WAGES (BASIC + DA)
  // H PF WAGES
  // I PF EMPLOYEE
  // J PF EMPLOYER
  // K EDLI & ADMIN CHARGES
  //
  // Snapshot values:
  // UAN         = snapshot.uanNumber
  // Days        = snapshot.payableDays
  // Gross Pay   = snapshot.gross
  // Basic + DA  = snapshot.wages
  // PF Employee = snapshot.pf
  //
  // Report-derived values:
  // PF Wages    = min(Wages, 15000)
  // PF Employer = PF Wages * 12%
  // EDLI/Admin  = PF Wages * 1%
  //
  // Employee PF is NOT recalculated here.
  //
  // All employees present in the current Payroll Run
  // snapshot are included.
  // =========================================================

  async getPfAnnexure(
    siteId: number,
    salaryMonthInput: Date,
  ) {
    const { salaryMonth, payrollRun } =
      await this.getCurrentPayrollRun(siteId, salaryMonthInput);

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const wagesBasicDa = this.money(snapshot.wages);

      const pfWages = this.money(Math.min(wagesBasicDa, 15000));

      const pfEmployee = this.money(snapshot.pf);
      const pfEmployer = this.money(pfWages * 0.12);
      const edliAdminCharges = this.money(pfWages * 0.01);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        uanNumber: snapshot.uanNumber,
        employeeName: snapshot.employeeName,

        payableDays: Number(snapshot.payableDays),

        grossPay: this.money(snapshot.gross),
        wagesBasicDa,
        pfWages,

        pfEmployee,
        pfEmployer,
        edliAdminCharges,
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.payableDays += employee.payableDays;
        total.grossPay += employee.grossPay;
        total.wagesBasicDa += employee.wagesBasicDa;
        total.pfWages += employee.pfWages;
        total.pfEmployee += employee.pfEmployee;
        total.pfEmployer += employee.pfEmployer;
        total.edliAdminCharges += employee.edliAdminCharges;

        return total;
      },
      {
        payableDays: 0,
        grossPay: 0,
        wagesBasicDa: 0,
        pfWages: 0,
        pfEmployee: 0,
        pfEmployer: 0,
        edliAdminCharges: 0,
      },
    );

    return {
      report: {
        reportType: 'PF_ANNEXURE',
        salaryMonth: salaryMonth.toISOString(),
        payrollRunId: payrollRun.id,
        payrollRunVersion: payrollRun.version,
        payrollRunStatus: payrollRun.status,
        employeeCount: employees.length,
      },

      employees,

      totals: {
        payableDays: Number(totals.payableDays.toFixed(1)),
        grossPay: this.money(totals.grossPay),
        wagesBasicDa: this.money(totals.wagesBasicDa),
        pfWages: this.money(totals.pfWages),
        pfEmployee: this.money(totals.pfEmployee),
        pfEmployer: this.money(totals.pfEmployer),
        edliAdminCharges: this.money(totals.edliAdminCharges),
      },
    };
  }

  // =========================================================
  // ESIC ANNEXURE
  //
  // Approved mapping:
  //
  // A SNO
  // B EMP ID
  // C ESIC NO
  // D EMP NAME
  // E DAYS INC PH
  // F GROSS PAY
  // G WAGES
  // H CONVEYANCE ALLOWANCE
  // I SPECIAL ALLOWANCE
  // J GROSS AFTER (CONV & SPECIAL DED)
  // K ESIC EMPLOYEE
  // L ESIC EMPLOYER
  //
  // Snapshot values:
  // ESIC No.          = snapshot.esicNumber
  // Days              = snapshot.payableDays
  // Gross             = snapshot.gross
  // Wages             = snapshot.wages
  // Conveyance        = snapshot.conveyance
  // Special Allowance = snapshot.specialAllowanceAmount
  // Employee ESIC     = snapshot.esic
  //
  // Report-derived values:
  //
  // ESIC Wage Base
  // = Gross - Conveyance - Special Allowance
  //
  // Employer ESIC
  // = ESIC Wage Base * 3.25%
  //
  // Employee ESIC is NOT recalculated here.
  //
  // No report-side ESIC eligibility ceiling/filter is
  // introduced.
  //
  // All employees present in the current Payroll Run
  // snapshot are included.
  // =========================================================

  async getEsicAnnexure(
    siteId: number,
    salaryMonthInput: Date,
  ) {
    const { salaryMonth, payrollRun } =
      await this.getCurrentPayrollRun(siteId, salaryMonthInput);

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      const grossPay = this.money(snapshot.gross);
      const wages = this.money(snapshot.wages);
      const conveyanceAllowance = this.money(snapshot.conveyance);
      const specialAllowance = this.money(snapshot.specialAllowanceAmount);

      const esicWages = this.money(
        grossPay - conveyanceAllowance - specialAllowance,
      );

      const esicEmployee = this.money(snapshot.esic);

      const esicEmployer = this.money(esicWages * 0.0325);

      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        esicNumber: snapshot.esicNumber,
        employeeName: snapshot.employeeName,

        payableDays: Number(snapshot.payableDays),

        grossPay,
        wages,

        conveyanceAllowance,
        specialAllowance,

        esicWages,

        esicEmployee,
        esicEmployer,
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.payableDays += employee.payableDays;
        total.grossPay += employee.grossPay;
        total.wages += employee.wages;
        total.specialAllowance += employee.specialAllowance;
        total.esicWages += employee.esicWages;
        total.esicEmployee += employee.esicEmployee;
        total.esicEmployer += employee.esicEmployer;

        return total;
      },
      {
        payableDays: 0,
        grossPay: 0,
        wages: 0,
        specialAllowance: 0,
        esicWages: 0,
        esicEmployee: 0,
        esicEmployer: 0,
      },
    );

    return {
      report: {
        reportType: 'ESIC_ANNEXURE',
        salaryMonth: salaryMonth.toISOString(),
        payrollRunId: payrollRun.id,
        payrollRunVersion: payrollRun.version,
        payrollRunStatus: payrollRun.status,
        employeeCount: employees.length,
      },

      employees,

      totals: {
        payableDays: Number(totals.payableDays.toFixed(1)),
        grossPay: this.money(totals.grossPay),
        wages: this.money(totals.wages),

        // Approved Excel TOTAL row intentionally leaves
        // Conveyance Allowance blank.

        specialAllowance: this.money(totals.specialAllowance),
        esicWages: this.money(totals.esicWages),
        esicEmployee: this.money(totals.esicEmployee),
        esicEmployer: this.money(totals.esicEmployer),
      },
    };
  }

  // =========================================================
  // PTAX ANNEXURE
  //
  // Approved mapping:
  //
  // A SNO
  // B EMP ID
  // C EMP NAME
  // D GENDER
  // E GROSS
  // F PTAX
  //
  // Snapshot values:
  // Gender = snapshot.gender
  // Gross  = snapshot.gross
  // PTax   = snapshot.ptax
  //
  // IMPORTANT:
  // PTax is NOT recalculated in this report.
  //
  // The finalized PayrollEmployeeSnapshot already contains
  // the PTax calculated by the Payroll compliance engine.
  //
  // Therefore this report preserves the historical payroll
  // value rather than applying current calculation rules.
  //
  // All employees present in the current Payroll Run
  // snapshot are included.
  // =========================================================

  async getPtaxAnnexure(
    siteId: number,
    salaryMonthInput: Date,
  ) {
    const { salaryMonth, payrollRun } =
      await this.getCurrentPayrollRun(siteId, salaryMonthInput);

    const employees = payrollRun.snapshots.map((snapshot, index) => {
      return {
        serialNumber: index + 1,

        employeeId: snapshot.employeeId,
        employeeName: snapshot.employeeName,
        gender: snapshot.gender,

        grossPay: this.money(snapshot.gross),
        ptax: this.money(snapshot.ptax),
      };
    });

    const totals = employees.reduce(
      (total, employee) => {
        total.grossPay += employee.grossPay;
        total.ptax += employee.ptax;

        return total;
      },
      {
        grossPay: 0,
        ptax: 0,
      },
    );

    return {
      report: {
        reportType: 'PTAX_ANNEXURE',
        salaryMonth: salaryMonth.toISOString(),
        payrollRunId: payrollRun.id,
        payrollRunVersion: payrollRun.version,
        payrollRunStatus: payrollRun.status,
        employeeCount: employees.length,
      },

      employees,

      totals: {
        grossPay: this.money(totals.grossPay),
        ptax: this.money(totals.ptax),
      },
    };
  }
}

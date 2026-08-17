import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollRunStatus, Prisma } from '@prisma/client';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollRepository } from './repository/payroll.repository';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly payrollCalculationService: PayrollCalculationService,
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
  // Payroll calculation uses full precision.
  //
  // Finalized snapshots persist monetary values at 2 decimal
  // places so finalized reports remain stable.
  // =========================================================

  private money(value: number): number {
    return Number(value.toFixed(2));
  }

  // =========================================================
  // SNAPSHOT MAPPING
  // =========================================================

  private buildSnapshot(
    payroll: Awaited<
      ReturnType<PayrollCalculationService['calculateEmployee']>
    >,
  ): Prisma.PayrollEmployeeSnapshotUncheckedCreateWithoutPayrollRunInput {
    const slab = payroll.earnings.specialAllowance.slab;

    return {
      employeeId: payroll.employee.id,
      wageMasterId: payroll.wageMaster.id,

      employeeName:
        `${payroll.employee.firstName} ${payroll.employee.lastName}`.trim(),

      gender: payroll.employee.gender,

      designationId: payroll.employee.designation.id,
      designationName: payroll.employee.designation.designationName,
      siteId: null,
      siteName: null,

      bankName: payroll.employee.bankName,
      accountHolderName: payroll.employee.accountHolderName,
      accountNumber: payroll.employee.accountNumber,
      ifscCode: payroll.employee.ifscCode,
      uanNumber: payroll.employee.uanNumber,
      esicNumber: payroll.employee.esicNumber,

      wageMasterVersion: payroll.wageMaster.version,

      presentDays: payroll.attendance.presentDays,
      halfDays: payroll.attendance.halfDays,
      paidHolidays: payroll.attendance.paidHolidays,
      payableDays: payroll.attendance.payableDays,
      otHours: payroll.attendance.otHours,

      monthlyBasic: this.money(payroll.earnings.monthlyBasic),

      monthlyDa: this.money(payroll.earnings.monthlyDa),

      earnedBasic: this.money(payroll.earnings.earnedBasic),

      earnedDa: this.money(payroll.earnings.earnedDa),

      wages: this.money(payroll.earnings.wages),

      hraPercentage: payroll.earnings.hraPercentage,

      hra: this.money(payroll.earnings.hra),

      otRate: this.money(payroll.earnings.otRate),

      otAmount: this.money(payroll.earnings.otAmount),

      conveyance: this.money(payroll.earnings.conveyance),

      specialAllowanceRate: slab
        ? this.money(payroll.earnings.specialAllowance.ratePerDay)
        : null,

      specialAllowanceMinDays: slab ? slab.minDays : null,

      specialAllowanceMaxDays: slab ? slab.maxDays : null,

      specialAllowanceAmount: this.money(
        payroll.earnings.specialAllowance.amount,
      ),

      rab: this.money(payroll.earnings.rab),

      arrears: this.money(payroll.earnings.arrears),

      gross: this.money(payroll.earnings.gross),

      pf: this.money(payroll.statutoryDeductions.pf),

      esic: this.money(payroll.statutoryDeductions.esic),

      ptax: this.money(payroll.statutoryDeductions.ptax),

      mlwf: this.money(payroll.statutoryDeductions.mlwf),

      statutoryDeductionTotal: this.money(payroll.statutoryDeductions.total),

      advanceRecovery: this.money(payroll.manualDeductions.advanceRecovery),

      canteen: this.money(payroll.manualDeductions.canteen),

      transport: this.money(payroll.manualDeductions.transport),

      uniformRecovery: this.money(payroll.manualDeductions.uniformRecovery),

      fine: this.money(payroll.manualDeductions.fine),

      otherDeduction: this.money(payroll.manualDeductions.otherDeduction),

      manualDeductionTotal: this.money(payroll.manualDeductions.total),

      totalDeductions: this.money(payroll.totalDeductions),

      netSalary: this.money(payroll.netSalary),

      warnings: payroll.warnings,
    };
  }

  // =========================================================
  // VALIDATE MONTHLY PREVIEW BEFORE FINALIZATION
  // =========================================================

  private async calculateFinalizablePayroll(salaryMonth: Date) {
    const preview =
      await this.payrollCalculationService.calculateMonthlyPreview(salaryMonth);

    if (preview.employeeCount === 0) {
      throw new BadRequestException(
        'No employees are eligible for payroll for the selected salary month.',
      );
    }

    if (preview.errorCount > 0) {
      throw new BadRequestException({
        message:
          'Payroll cannot be finalized because one or more employees have payroll validation errors.',
        errors: preview.errors,
      });
    }

    return preview;
  }

  // =========================================================
  // FINALIZE
  // =========================================================

  async finalize(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const currentRun =
      await this.payrollRepository.findCurrentPayrollRun(salaryMonth);

    if (currentRun?.status === PayrollRunStatus.FINALIZED) {
      throw new ConflictException(
        `Payroll is already finalized for ${salaryMonth.toISOString()}. Unlock it before reprocessing.`,
      );
    }

    if (currentRun?.status === PayrollRunStatus.UNLOCKED) {
      throw new ConflictException(
        `Payroll for ${salaryMonth.toISOString()} is currently unlocked. Use reprocess after completing corrections.`,
      );
    }

    const preview = await this.calculateFinalizablePayroll(salaryMonth);

    const latestRun =
      await this.payrollRepository.findLatestPayrollRun(salaryMonth);

    const version = latestRun ? latestRun.version + 1 : 1;

    const snapshots = preview.payrolls.map((payroll) =>
      this.buildSnapshot(payroll),
    );

    const payrollRun = await this.payrollRepository.createFinalizedPayrollRun(
      salaryMonth,
      version,
      snapshots,
    );

    return {
      success: true,
      message: 'Payroll finalized successfully.',
      data: payrollRun,
    };
  }
  // =========================================================
  // PAYROLL RUN HISTORY
  // =========================================================

  async findRuns(salaryMonthInput?: Date) {
    let salaryMonth: Date | undefined;

    if (salaryMonthInput) {
      if (Number.isNaN(salaryMonthInput.getTime())) {
        throw new BadRequestException('Salary month is invalid.');
      }

      salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);
    }

    const runs = await this.payrollRepository.findPayrollRuns(salaryMonth);

    return {
      success: true,
      message: 'Payroll Runs fetched successfully.',

      data: runs.map((run) => ({
        id: run.id,
        salaryMonth: run.salaryMonth,
        version: run.version,
        status: run.status,
        finalizedAt: run.finalizedAt,
        unlockedAt: run.unlockedAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        employeeCount: run._count.snapshots,
      })),
    };
  }

  // =========================================================
  // CURRENT PAYROLL RUN
  // =========================================================

  async findCurrent(salaryMonthInput: Date) {
    if (Number.isNaN(salaryMonthInput.getTime())) {
      throw new BadRequestException('Salary month is invalid.');
    }

    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const payrollRun =
      await this.payrollRepository.findCurrentPayrollRunWithSnapshots(
        salaryMonth,
      );

    if (!payrollRun) {
      throw new NotFoundException(
        `No current Payroll Run found for ${salaryMonth.toISOString()}.`,
      );
    }

    return {
      success: true,
      message: 'Current Payroll Run fetched successfully.',
      data: payrollRun,
    };
  }

  // =========================================================
  // FIND PAYROLL RUN
  // =========================================================

  async findOne(id: number) {
    const payrollRun = await this.payrollRepository.findPayrollRunById(id);

    if (!payrollRun) {
      throw new NotFoundException(`Payroll Run with ID ${id} not found.`);
    }

    return {
      success: true,
      message: 'Payroll Run fetched successfully.',
      data: payrollRun,
    };
  }

  // =========================================================
  // UNLOCK
  // =========================================================

  async unlock(id: number) {
    const payrollRun = await this.payrollRepository.findPayrollRunById(id);

    if (!payrollRun) {
      throw new NotFoundException(`Payroll Run with ID ${id} not found.`);
    }

    if (payrollRun.status === PayrollRunStatus.UNLOCKED) {
      throw new ConflictException(
        `Payroll Run with ID ${id} is already unlocked.`,
      );
    }

    if (payrollRun.status === PayrollRunStatus.SUPERSEDED) {
      throw new ConflictException(
        `Payroll Run with ID ${id} has been superseded and cannot be unlocked.`,
      );
    }

    const currentRun = await this.payrollRepository.findCurrentPayrollRun(
      payrollRun.salaryMonth,
    );

    if (!currentRun || currentRun.id !== payrollRun.id) {
      throw new ConflictException(
        'Only the current finalized Payroll Run can be unlocked.',
      );
    }

    const unlocked = await this.payrollRepository.unlockPayrollRun(id);

    return {
      success: true,
      message: 'Payroll unlocked successfully.',
      data: unlocked,
    };
  }

  // =========================================================
  // REPROCESS
  // =========================================================

  async reprocess(payrollRunId: number) {
    const oldRun =
      await this.payrollRepository.findPayrollRunById(payrollRunId);

    if (!oldRun) {
      throw new NotFoundException(
        `Payroll Run with ID ${payrollRunId} not found.`,
      );
    }

    if (oldRun.status !== PayrollRunStatus.UNLOCKED) {
      throw new ConflictException(
        'Payroll must be unlocked before reprocessing.',
      );
    }

    const latestRun = await this.payrollRepository.findLatestPayrollRun(
      oldRun.salaryMonth,
    );

    if (!latestRun || latestRun.id !== oldRun.id) {
      throw new ConflictException(
        'Only the latest unlocked Payroll Run can be reprocessed.',
      );
    }

    const preview = await this.calculateFinalizablePayroll(oldRun.salaryMonth);

    const newVersion = latestRun.version + 1;

    const snapshots = preview.payrolls.map((payroll) =>
      this.buildSnapshot(payroll),
    );

    const newPayrollRun = await this.payrollRepository.reprocessPayrollRun(
      oldRun.id,
      oldRun.salaryMonth,
      newVersion,
      snapshots,
    );

    return {
      success: true,
      message: 'Payroll reprocessed successfully.',
      data: newPayrollRun,
    };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollService } from './payroll.service';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { MonthlyPayrollPreviewQueryDto } from './dto/monthly-payroll-preview-query.dto';
import { FinalizePayrollDto } from './dto/finalize-payroll.dto';
import { ReprocessPayrollDto } from './dto/reprocess-payroll.dto';
import { PayrollRunQueryDto } from './dto/payroll-run-query.dto';

@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollCalculationService: PayrollCalculationService,
    private readonly payrollService: PayrollService,
  ) {}

  // =========================================================
  // MONEY OUTPUT
  // =========================================================

  private money(value: number): number {
    return Number(value.toFixed(2));
  }

  private formatEmployeePayroll<
    T extends Awaited<
      ReturnType<PayrollCalculationService['calculateEmployee']>
    >,
  >(payroll: T) {
    return {
      ...payroll,

      earnings: {
        ...payroll.earnings,

        monthlyBasic: this.money(payroll.earnings.monthlyBasic),

        monthlyDa: this.money(payroll.earnings.monthlyDa),

        earnedBasic: this.money(payroll.earnings.earnedBasic),

        earnedDa: this.money(payroll.earnings.earnedDa),

        wages: this.money(payroll.earnings.wages),

        hraPercentage: payroll.earnings.hraPercentage,

        hra: this.money(payroll.earnings.hra),

        otRate: this.money(payroll.earnings.otRate),

        otHours: payroll.earnings.otHours,

        otAmount: this.money(payroll.earnings.otAmount),

        conveyance: this.money(payroll.earnings.conveyance),

        specialAllowance: {
          ...payroll.earnings.specialAllowance,

          ratePerDay: this.money(payroll.earnings.specialAllowance.ratePerDay),

          amount: this.money(payroll.earnings.specialAllowance.amount),
        },

        rab: this.money(payroll.earnings.rab),

        arrears: this.money(payroll.earnings.arrears),

        gross: this.money(payroll.earnings.gross),
      },

      statutoryDeductions: {
        pf: this.money(payroll.statutoryDeductions.pf),

        esic: this.money(payroll.statutoryDeductions.esic),

        ptax: this.money(payroll.statutoryDeductions.ptax),

        mlwf: this.money(payroll.statutoryDeductions.mlwf),

        total: this.money(payroll.statutoryDeductions.total),
      },

      manualDeductions: {
        advanceRecovery: this.money(payroll.manualDeductions.advanceRecovery),

        canteen: this.money(payroll.manualDeductions.canteen),

        transport: this.money(payroll.manualDeductions.transport),

        uniformRecovery: this.money(payroll.manualDeductions.uniformRecovery),

        fine: this.money(payroll.manualDeductions.fine),

        otherDeduction: this.money(payroll.manualDeductions.otherDeduction),

        total: this.money(payroll.manualDeductions.total),
      },

      totalDeductions: this.money(payroll.totalDeductions),

      netSalary: this.money(payroll.netSalary),
    };
  }

  // =========================================================
  // SINGLE EMPLOYEE PREVIEW
  // =========================================================

  @Get('preview')
  async preview(@Query() query: PayrollPreviewQueryDto) {
    const result = await this.payrollCalculationService.calculateEmployee(
      query.employeeId,
      new Date(query.salaryMonth),
    );

    return {
      success: true,
      message: 'Payroll preview calculated successfully.',
      data: this.formatEmployeePayroll(result),
    };
  }

  // =========================================================
  // COMPANY-WIDE MONTHLY PREVIEW
  // =========================================================

  @Get('preview/monthly')
  async monthlyPreview(@Query() query: MonthlyPayrollPreviewQueryDto) {
    const result = await this.payrollCalculationService.calculateMonthlyPreview(
      new Date(query.salaryMonth),
    );

    return {
      success: true,
      message: 'Monthly payroll preview calculated successfully.',

      data: {
        salaryMonth: result.salaryMonth,

        employeeCount: result.employeeCount,
        processedCount: result.processedCount,
        errorCount: result.errorCount,

        payrolls: result.payrolls.map((payroll) =>
          this.formatEmployeePayroll(payroll),
        ),

        summary: {
          gross: this.money(result.summary.gross),

          pf: this.money(result.summary.pf),

          esic: this.money(result.summary.esic),

          ptax: this.money(result.summary.ptax),

          mlwf: this.money(result.summary.mlwf),

          manualDeductions: this.money(result.summary.manualDeductions),

          totalDeductions: this.money(result.summary.totalDeductions),

          netSalary: this.money(result.summary.netSalary),
        },

        errors: result.errors,
      },
    };
  }

  // =========================================================
  // FINALIZE PAYROLL
  // =========================================================

  @Post('finalize')
  async finalize(@Body() dto: FinalizePayrollDto) {
    return this.payrollService.finalize(new Date(dto.salaryMonth));
  }

  // =========================================================
  // GET FINALIZED / HISTORICAL PAYROLL RUN
  // =========================================================

  // =========================================================
  // PAYROLL RUN HISTORY
  // =========================================================

  @Get('runs')
  async findRuns(@Query() query: PayrollRunQueryDto) {
    return this.payrollService.findRuns(
      query.salaryMonth ? new Date(query.salaryMonth) : undefined,
    );
  }

  // =========================================================
  // CURRENT PAYROLL RUN FOR SALARY MONTH
  // =========================================================

  @Get('current')
  async findCurrent(@Query() query: MonthlyPayrollPreviewQueryDto) {
    return this.payrollService.findCurrent(new Date(query.salaryMonth));
  }

  @Get('runs/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.payrollService.findOne(id);
  }

  // =========================================================
  // UNLOCK PAYROLL
  // =========================================================

  @Patch(':id/unlock')
  async unlock(@Param('id', ParseIntPipe) id: number) {
    return this.payrollService.unlock(id);
  }

  // =========================================================
  // REPROCESS PAYROLL
  // =========================================================

  @Post('reprocess')
  async reprocess(@Body() dto: ReprocessPayrollDto) {
    return this.payrollService.reprocess(dto.payrollRunId);
  }
}

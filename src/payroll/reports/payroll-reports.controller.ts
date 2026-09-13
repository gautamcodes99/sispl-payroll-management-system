import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { WageSheetQueryDto } from './dto/wage-sheet-query.dto';
import { FormIiQueryDto } from './dto/form-ii-query.dto';
import { PayrollReportsService } from './payroll-reports.service';
import { UpdatePayrollPaymentDto } from './dto/update-payroll-payment.dto';
import { BulkUpdatePayrollPaymentDto } from './dto/bulk-update-payroll-payment.dto';
import { SalaryRegisterQueryDto } from './dto/salary-register-query.dto';
import { BankTransferQueryDto } from './dto/bank-transfer-query.dto';
import { PayslipQueryDto } from './dto/payslip-query.dto';
import { HraRegisterQueryDto } from './dto/hra-register-query.dto';
import { RegisterOfAdvancesQueryDto } from './dto/register-of-advances-query.dto';
import { RegisterOfDamagesOrLossQueryDto } from './dto/register-of-damages-or-loss-query.dto';
import { RegisterOfFinesQueryDto } from './dto/register-of-fines-query.dto';
import { OverallDeductionSummaryQueryDto } from './dto/overall-deduction-summary-query.dto';

@Controller('payroll/reports')
export class PayrollReportsController {
  constructor(private readonly payrollReportsService: PayrollReportsService) {}

  // =========================================================
  // WAGE SHEET
  //
  // Internal SISPL company Wage Sheet.
  //
  // Uses the current finalized/unlocked Payroll Run snapshot.
  // =========================================================

  @Get('wage-sheet')
  async getWageSheet(@Query() query: WageSheetQueryDto) {
    return this.payrollReportsService.getWageSheet(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }

  // =========================================================
  // FORM II - MUSTER ROLL CUM WAGE REGISTER
  //
  // Site-wise statutory Payroll Report.
  //
  // Payroll values come from the selected Site's persisted
  // Payroll Run snapshot. Daily Attendance is restricted to
  // the same Site.
  // =========================================================

  @Get('form-ii')
  async getFormIi(@Query() query: FormIiQueryDto) {
    return this.payrollReportsService.getFormIi(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // BANK TRANSFER - UPDATE SINGLE PAYMENT
  // =========================================================

  @Patch('bank-transfer/:snapshotId/payment')
  async updatePayrollPayment(
    @Param('snapshotId', ParseIntPipe) snapshotId: number,
    @Body() dto: UpdatePayrollPaymentDto,
  ) {
    return this.payrollReportsService.updatePayrollPayment(
      snapshotId,
      dto.status,
      dto.paymentDate,
      dto.paymentMode,
    );
  }

  // =========================================================
  // BANK TRANSFER - BULK UPDATE PAYMENTS
  // =========================================================

  @Patch('bank-transfer/payments/bulk')
  async bulkUpdatePayrollPayment(@Body() dto: BulkUpdatePayrollPaymentDto) {
    return this.payrollReportsService.bulkUpdatePayrollPayment(
      dto.snapshotIds,
      dto.status,
      dto.paymentDate,
      dto.paymentMode,
    );
  }
  // =========================================================
  // SALARY REGISTER
  // =========================================================

  @Get('salary-register')
  async getSalaryRegister(@Query() query: SalaryRegisterQueryDto) {
    return this.payrollReportsService.getSalaryRegister(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }

  // =========================================================
  // BANK TRANSFER STATEMENT
  // =========================================================

  @Get('bank-transfer')
  async getBankTransferStatement(@Query() query: BankTransferQueryDto) {
    return this.payrollReportsService.getBankTransferStatement(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // PAYSLIP
  //
  // Site-wise monthly Payslip report.
  // Historical Site comes from PayrollEmployeeSnapshot.
  // =========================================================

  @Get('payslip')
  async getPayslip(@Query() query: PayslipQueryDto) {
    return this.payrollReportsService.getPayslip(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // HRA REGISTER - FORM A
  //
  // Site-wise statutory Payroll Report.
  // Uses the selected Site's persisted Payroll Run snapshot.
  // =========================================================

  @Get('hra-register')
  async getHraRegister(@Query() query: HraRegisterQueryDto) {
    return this.payrollReportsService.getHraRegister(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // FORM XIII - REGISTER OF ADVANCES
  //
  // Site-wise statutory Deduction Report.
  //
  // Advance position comes from the established Manual
  // Deduction advance ledger for the selected Site/month.
  //
  // Earnings come from the selected Site's persisted Payroll
  // Employee Snapshot.
  // =========================================================

  @Get('register-of-advances')
  async getRegisterOfAdvances(@Query() query: RegisterOfAdvancesQueryDto) {
    return this.payrollReportsService.getRegisterOfAdvances(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // FORM XVI - REGISTER OF DEDUCTIONS FOR DAMAGES OR LOSS
  //
  // Site-wise statutory Deduction Report.
  //
  // Other Deduction from the selected Site's persisted Payroll
  // Snapshot is treated as Amount of Deduction Imposed.
  // =========================================================

  @Get('register-of-damages-or-loss')
  async getRegisterOfDamagesOrLoss(
    @Query() query: RegisterOfDamagesOrLossQueryDto,
  ) {
    return this.payrollReportsService.getRegisterOfDamagesOrLoss(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // FORM XVII - REGISTER OF FINES
  //
  // Site-wise statutory Deduction Report.
  //
  // Fine amount comes from the selected Site's persisted
  // Payroll Snapshot. Department is intentionally not used.
  // =========================================================

  @Get('register-of-fines')
  async getRegisterOfFines(@Query() query: RegisterOfFinesQueryDto) {
    return this.payrollReportsService.getRegisterOfFines(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // OVERALL DEDUCTION SUMMARY
  // =========================================================

  @Get('overall-deduction-summary')
  async getOverallDeductionSummary(
    @Query() query: OverallDeductionSummaryQueryDto,
  ) {
    return this.payrollReportsService.getOverallDeductionSummary(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
}

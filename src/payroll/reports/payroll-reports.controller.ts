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
    return this.payrollReportsService.getWageSheet(new Date(query.salaryMonth));
  }

  // =========================================================
  // FORM II - MUSTER ROLL CUM WAGE REGISTER
  //
  // Company-wide statutory Payroll Report.
  //
  // No Site / Work Type / Department filters.
  // =========================================================

  @Get('form-ii')
  async getFormIi(@Query() query: FormIiQueryDto) {
    return this.payrollReportsService.getFormIi(new Date(query.salaryMonth));
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
      new Date(query.salaryMonth),
    );
  }

  // =========================================================
  // BANK TRANSFER STATEMENT
  // =========================================================

  @Get('bank-transfer')
  async getBankTransferStatement(@Query() query: BankTransferQueryDto) {
    return this.payrollReportsService.getBankTransferStatement(
      new Date(query.salaryMonth),
    );
  }
  // =========================================================
  // PAYSLIP
  //
  // Company-wide monthly Payslip report.
  // Site is derived per employee from monthly Attendance.
  // =========================================================

  @Get('payslip')
  async getPayslip(@Query() query: PayslipQueryDto) {
    return this.payrollReportsService.getPayslip(new Date(query.salaryMonth));
  }
  // =========================================================
  // HRA REGISTER - FORM A
  //
  // Company-wide statutory Payroll Report.
  //
  // No Site / Work Type / Department filters.
  // =========================================================

  @Get('hra-register')
  async getHraRegister(@Query() query: HraRegisterQueryDto) {
    return this.payrollReportsService.getHraRegister(
      new Date(query.salaryMonth),
    );
  }
}

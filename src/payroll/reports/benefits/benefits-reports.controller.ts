import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { BenefitsReportsService } from './benefits-reports.service';
import { FnFSettlementEmployeesQueryDto } from './dto/fnf-settlement-employees-query.dto';
import { FnFSettlementQueryDto } from './dto/fnf-settlement-query.dto';
import { UpdateFnFSettlementDto } from './dto/update-fnf-settlement.dto';
import { BonusBankTransferQueryDto } from './dto/bonus-bank-transfer-query.dto';
import { BonusFormCQueryDto } from './dto/bonus-form-c-query.dto';
import { BonusSettingQueryDto } from './dto/bonus-setting-query.dto';
import { BonusWorkingSheetQueryDto } from './dto/bonus-working-sheet-query.dto';
import { Form20QueryDto } from './dto/form-20-query.dto';
import { LeavePayBankTransferQueryDto } from './dto/leave-pay-bank-transfer-query.dto';
import { LeaveWorkingSheetQueryDto } from './dto/leave-working-sheet-query.dto';
import { UpdateBonusPaymentsDto } from './dto/update-bonus-payments.dto';
import { UpdateBonusSettingDto } from './dto/update-bonus-setting.dto';
import { UpdateLeavePaymentsDto } from './dto/update-leave-payments.dto';

@Controller('benefit-reports')
export class BenefitsReportsController {
  constructor(
    private readonly benefitsReportsService: BenefitsReportsService,
  ) {}

  @Get('leave-working-sheet')
  async getLeaveWorkingSheet(@Query() query: LeaveWorkingSheetQueryDto) {
    return this.benefitsReportsService.getLeaveWorkingSheet(
      query.siteId,
      query.year,
    );
  }

  @Get('form-20')
  async getForm20(@Query() query: Form20QueryDto) {
    return this.benefitsReportsService.getForm20(
      query.siteId,
      query.year,
    );
  }

  @Get('leave-pay-bank-transfer')
  async getLeavePayBankTransfer(@Query() query: LeavePayBankTransferQueryDto) {
    return this.benefitsReportsService.getLeavePayBankTransfer(
      query.siteId,
      query.year,
    );
  }

  @Patch('leave-payments')
  async updateLeavePayments(@Body() dto: UpdateLeavePaymentsDto) {
    return this.benefitsReportsService.updateLeavePayments(dto);
  }

  @Get('bonus-working-sheet')
  async getBonusWorkingSheet(@Query() query: BonusWorkingSheetQueryDto) {
    return this.benefitsReportsService.getBonusWorkingSheet(
      query.siteId,
      query.financialYear,
    );
  }
  @Get('bonus-form-c')
  async getBonusFormC(@Query() query: BonusFormCQueryDto) {
    return this.benefitsReportsService.getBonusFormC(
      query.siteId,
      query.financialYear,
    );
  }

  @Get('bonus-bank-transfer')
  async getBonusBankTransfer(@Query() query: BonusBankTransferQueryDto) {
    return this.benefitsReportsService.getBonusBankTransfer(
      query.siteId,
      query.financialYear,
    );
  }

  @Patch('bonus-payments')
  async updateBonusPayments(@Body() dto: UpdateBonusPaymentsDto) {
    return this.benefitsReportsService.updateBonusPayments(dto);
  }

  @Get('bonus-setting')
  async getBonusSetting(@Query() query: BonusSettingQueryDto) {
    return this.benefitsReportsService.getBonusSetting(query.financialYear);
  }

  @Patch('bonus-setting')
  async updateBonusSetting(@Body() dto: UpdateBonusSettingDto) {
    return this.benefitsReportsService.updateBonusSetting(dto);
  }

  // =========================================================
  // FULL AND FINAL SETTLEMENT
  // =========================================================

  @Get('fnf-settlement-employees')
  async getFnFSettlementEmployees(
    @Query() query: FnFSettlementEmployeesQueryDto,
  ) {
    return this.benefitsReportsService.getFnFSettlementEmployees(
      query.siteId,
      query.month,
    );
  }

  @Get('fnf-settlement')
  async getFnFSettlement(@Query() query: FnFSettlementQueryDto) {
    return this.benefitsReportsService.getFnFSettlement(
      query.siteId,
      query.employeeId,
    );
  }

  @Patch('fnf-settlement')
  async updateFnFSettlement(@Body() dto: UpdateFnFSettlementDto) {
    return this.benefitsReportsService.updateFnFSettlement(dto);
  }
}

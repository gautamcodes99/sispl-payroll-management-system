import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { BenefitsReportsService } from './benefits-reports.service';
import { BonusSettingQueryDto } from './dto/bonus-setting-query.dto';
import { BonusWorkingSheetQueryDto } from './dto/bonus-working-sheet-query.dto';
import { Form20QueryDto } from './dto/form-20-query.dto';
import { LeavePayBankTransferQueryDto } from './dto/leave-pay-bank-transfer-query.dto';
import { LeaveWorkingSheetQueryDto } from './dto/leave-working-sheet-query.dto';
import { UpdateBonusSettingDto } from './dto/update-bonus-setting.dto';
import { UpdateLeavePaymentsDto } from './dto/update-leave-payments.dto';

@Controller('benefit-reports')
export class BenefitsReportsController {
  constructor(
    private readonly benefitsReportsService: BenefitsReportsService,
  ) {}

  @Get('leave-working-sheet')
  async getLeaveWorkingSheet(@Query() query: LeaveWorkingSheetQueryDto) {
    return this.benefitsReportsService.getLeaveWorkingSheet(query.year);
  }

  @Get('form-20')
  async getForm20(@Query() query: Form20QueryDto) {
    return this.benefitsReportsService.getForm20(query.year);
  }

  @Get('leave-pay-bank-transfer')
  async getLeavePayBankTransfer(@Query() query: LeavePayBankTransferQueryDto) {
    return this.benefitsReportsService.getLeavePayBankTransfer(query.year);
  }

  @Patch('leave-payments')
  async updateLeavePayments(@Body() dto: UpdateLeavePaymentsDto) {
    return this.benefitsReportsService.updateLeavePayments(dto);
  }

  @Get('bonus-working-sheet')
  async getBonusWorkingSheet(@Query() query: BonusWorkingSheetQueryDto) {
    return this.benefitsReportsService.getBonusWorkingSheet(
      query.financialYear,
    );
  }
  @Get('bonus-setting')
  async getBonusSetting(@Query() query: BonusSettingQueryDto) {
    return this.benefitsReportsService.getBonusSetting(query.financialYear);
  }

  @Patch('bonus-setting')
  async updateBonusSetting(@Body() dto: UpdateBonusSettingDto) {
    return this.benefitsReportsService.updateBonusSetting(dto);
  }
}
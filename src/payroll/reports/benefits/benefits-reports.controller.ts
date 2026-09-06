import { Controller, Get, Query } from '@nestjs/common';
import { BenefitsReportsService } from './benefits-reports.service';
import { Form20QueryDto } from './dto/form-20-query.dto';
import { LeaveWorkingSheetQueryDto } from './dto/leave-working-sheet-query.dto';

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
}

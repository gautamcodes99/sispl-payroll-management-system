import { Controller, Get, Query } from '@nestjs/common';
import { BenefitsReportsService } from './benefits-reports.service';
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
}

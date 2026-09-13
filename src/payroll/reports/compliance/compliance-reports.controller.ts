import { Controller, Get, Query } from '@nestjs/common';
import { ComplianceReportQueryDto } from './dto/compliance-report-query.dto';
import { ComplianceReportsService } from './compliance-reports.service';

@Controller('compliance-reports')
export class ComplianceReportsController {
  constructor(
    private readonly complianceReportsService: ComplianceReportsService,
  ) {}

  // =========================================================
  // PF ANNEXURE
  //
  // Site-wise statutory Compliance Report.
  //
  // Uses the current FINALIZED / UNLOCKED Payroll Run
  // snapshot.
  // =========================================================

  @Get('pf-annexure')
  async getPfAnnexure(@Query() query: ComplianceReportQueryDto) {
    return this.complianceReportsService.getPfAnnexure(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }

  // =========================================================
  // ESIC ANNEXURE
  //
  // Site-wise statutory Compliance Report.
  //
  // Uses the current FINALIZED / UNLOCKED Payroll Run
  // snapshot.
  // =========================================================

  @Get('esic-annexure')
  async getEsicAnnexure(@Query() query: ComplianceReportQueryDto) {
    return this.complianceReportsService.getEsicAnnexure(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }

  // =========================================================
  // PTAX ANNEXURE
  //
  // Site-wise statutory Compliance Report.
  //
  // Uses the current FINALIZED / UNLOCKED Payroll Run
  // snapshot.
  // =========================================================

  @Get('ptax-annexure')
  async getPtaxAnnexure(@Query() query: ComplianceReportQueryDto) {
    return this.complianceReportsService.getPtaxAnnexure(
      query.siteId,
      new Date(query.salaryMonth),
    );
  }
}

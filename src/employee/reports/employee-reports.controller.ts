import { Controller, Get, Query } from '@nestjs/common';

import { JoiningRegisterQueryDto } from './dto/joining-register-query.dto';
import { LeftEmployeeReportQueryDto } from './dto/left-employee-report-query.dto';
import { EmployeeReportsService } from './employee-reports.service';

@Controller('employee-reports')
export class EmployeeReportsController {
  constructor(
    private readonly employeeReportsService: EmployeeReportsService,
  ) {}

  // =========================================================
  // JOINING REGISTER
  //
  // GET /api/v1/employee-reports/joining-register
  //     ?month=2026-08-01
  // =========================================================

  @Get('joining-register')
  getJoiningRegister(@Query() query: JoiningRegisterQueryDto) {
    return this.employeeReportsService.getJoiningRegister(query);
  }

  // =========================================================
  // LEFT EMPLOYEE REPORT
  //
  // GET /api/v1/employee-reports/left-employees
  //     ?fromDate=2026-08-01
  //     &toDate=2026-08-31
  // =========================================================

  @Get('left-employees')
  getLeftEmployeeReport(@Query() query: LeftEmployeeReportQueryDto) {
    return this.employeeReportsService.getLeftEmployeeReport(query);
  }
}

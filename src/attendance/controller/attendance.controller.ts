import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AttendanceService } from '../service/attendance.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { PendingAttendanceQueryDto } from '../dto/pending-attendance-query.dto';
import { AttendanceDashboardQueryDto } from '../dto/attendance-dashboard-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { BulkOtUpdateDto } from '../dto/bulk-ot-update.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';
import { AttendanceReportQueryDto } from '../dto/attendance-report-query.dto';
import { FormXxiiiReportQueryDto } from '../dto/form-xxiii-report-query.dto';
import { MusterCutFileQueryDto } from '../dto/muster-cut-file-query.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(createAttendanceDto);
  }

  @Post('bulk')
  bulkCreate(@Body() bulkAttendanceDto: BulkAttendanceDto) {
    return this.attendanceService.bulkCreateAttendance(bulkAttendanceDto);
  }
  @Patch('bulk-ot')
  bulkUpdateOt(@Body() bulkOtUpdateDto: BulkOtUpdateDto) {
    return this.attendanceService.bulkUpdateOt(bulkOtUpdateDto);
  }

  @Get()
  findAll(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAttendances(query);
  }

  @Get('dashboard')
  getDashboardSummary(@Query() query: AttendanceDashboardQueryDto) {
    return this.attendanceService.getDashboardSummary(query);
  }

  @Get('monthly-summary')
  getMonthlyAttendanceSummary(@Query() query: MonthlyAttendanceQueryDto) {
    return this.attendanceService.getMonthlyAttendanceSummary(query);
  }

  @Get('pending')
  findPendingEmployees(@Query() query: PendingAttendanceQueryDto) {
    return this.attendanceService.findPendingEmployees(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - MUSTER
  // =========================================================

  @Get('reports/muster')
  getMusterReport(@Query() query: AttendanceReportQueryDto) {
    return this.attendanceService.getMusterReport(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - OT MUSTER
  // =========================================================

  @Get('reports/ot-muster')
  getOtMusterReport(@Query() query: AttendanceReportQueryDto) {
    return this.attendanceService.getOtMusterReport(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - MUSTER WITH OT
  // =========================================================

  @Get('reports/muster-with-ot')
  getMusterWithOtReport(@Query() query: AttendanceReportQueryDto) {
    return this.attendanceService.getMusterWithOtReport(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - FORM XXIII
  // REGISTER OF OVERTIME
  // =========================================================

  @Get('reports/form-xxiii')
  getFormXxiiiReport(@Query() query: FormXxiiiReportQueryDto) {
    return this.attendanceService.getFormXxiiiReport(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - MUSTER CUT FILE
  // =========================================================

  @Get('reports/muster-cut-file')
  getMusterCutFileReport(@Query() query: MusterCutFileQueryDto) {
    return this.attendanceService.getMusterCutFileReport(query);
  }
  // =========================================================
  // ATTENDANCE REPORTS - OT MUSTER CUT FILE
  // =========================================================

  @Get('reports/ot-muster-cut-file')
  getOtMusterCutFileReport(@Query() query: MusterCutFileQueryDto) {
    return this.attendanceService.getOtMusterCutFileReport(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.findAttendanceById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.updateAttendance(id, updateAttendanceDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.deleteAttendance(id);
  }
}

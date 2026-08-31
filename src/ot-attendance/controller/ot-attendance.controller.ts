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
import { OtAttendanceService } from '../service/ot-attendance.service';
import { CreateOtAttendanceDto } from '../dto/create-ot-attendance.dto';
import { BulkOtAttendanceDto } from '../dto/bulk-ot-attendance.dto';
import { UpdateOtAttendanceDto } from '../dto/update-ot-attendance.dto';
import { OtAttendanceQueryDto } from '../dto/ot-attendance-query.dto';

@Controller('ot-attendance')
export class OtAttendanceController {
  constructor(private readonly otAttendanceService: OtAttendanceService) {}

  @Post()
  create(@Body() dto: CreateOtAttendanceDto) {
    return this.otAttendanceService.create(dto);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkOtAttendanceDto) {
    return this.otAttendanceService.bulkCreate(dto);
  }

  @Get()
  findAll(@Query() query: OtAttendanceQueryDto) {
    return this.otAttendanceService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.otAttendanceService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOtAttendanceDto,
  ) {
    return this.otAttendanceService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.otAttendanceService.delete(id);
  }
}

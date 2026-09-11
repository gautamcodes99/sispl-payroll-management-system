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
import { CreateHolidayCalendarDto } from '../dto/create-holiday-calendar.dto';
import { HolidayCalendarQueryDto } from '../dto/holiday-calendar-query.dto';
import { UpdateHolidayCalendarDto } from '../dto/update-holiday-calendar.dto';
import { HolidayCalendarService } from '../service/holiday-calendar.service';

@Controller('holiday-calendar')
export class HolidayCalendarController {
  constructor(
    private readonly holidayCalendarService: HolidayCalendarService,
  ) {}

  @Post()
  create(@Body() dto: CreateHolidayCalendarDto) {
    return this.holidayCalendarService.create(dto);
  }

  @Get()
  findAll(@Query() query: HolidayCalendarQueryDto) {
    return this.holidayCalendarService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.holidayCalendarService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayCalendarDto,
  ) {
    return this.holidayCalendarService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.holidayCalendarService.remove(id);
  }
}

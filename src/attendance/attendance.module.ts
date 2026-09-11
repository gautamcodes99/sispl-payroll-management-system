import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HolidayCalendarModule } from '../holiday-calendar/holiday-calendar.module';

import { AttendanceController } from './controller/attendance.controller';
import { AttendanceService } from './service/attendance.service';
import { AttendanceRepository } from './repository/attendance.repository';

@Module({
  imports: [PrismaModule, HolidayCalendarModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}

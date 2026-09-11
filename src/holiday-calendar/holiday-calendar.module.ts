import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HolidayCalendarController } from './controller/holiday-calendar.controller';
import { HolidayCalendarRepository } from './repository/holiday-calendar.repository';
import { HolidayCalendarService } from './service/holiday-calendar.service';

@Module({
  imports: [PrismaModule],
  controllers: [HolidayCalendarController],
  providers: [HolidayCalendarService, HolidayCalendarRepository],
  exports: [HolidayCalendarService, HolidayCalendarRepository],
})
export class HolidayCalendarModule {}

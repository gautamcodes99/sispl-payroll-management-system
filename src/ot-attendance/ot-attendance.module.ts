import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OtAttendanceController } from './controller/ot-attendance.controller';
import { OtAttendanceService } from './service/ot-attendance.service';
import { OtAttendanceRepository } from './repository/ot-attendance.repository';

@Module({
  imports: [PrismaModule],
  controllers: [OtAttendanceController],
  providers: [OtAttendanceService, OtAttendanceRepository],
})
export class OtAttendanceModule {}

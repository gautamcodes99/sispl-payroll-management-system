import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeeModule } from './employee/employee.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { AttendanceModule } from './attendance/attendance.module';
import { OrganisationModule } from './organisation/organisation.module';

@Module({
  imports: [EmployeeModule, PrismaModule, AttendanceModule, OrganisationModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

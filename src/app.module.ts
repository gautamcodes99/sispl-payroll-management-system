import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeeModule } from './employee/employee.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { AttendanceModule } from './attendance/attendance.module';
import { OrganisationModule } from './organisation/organisation.module';
import { WageMasterModule } from './wage-master/wage-master.module';
import { VariableAllowanceModule } from './variable-allowance/variable-allowance.module';

@Module({
  imports: [
    EmployeeModule,
    PrismaModule,
    AttendanceModule,
    OrganisationModule,
    WageMasterModule,
    VariableAllowanceModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

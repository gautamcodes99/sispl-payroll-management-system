import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmployeeModule } from './employee/employee.module';
import { ManualDeductionModule } from './manual-deduction/manual-deduction.module';
import { OrganisationModule } from './organisation/organisation.module';
import { OtAttendanceModule } from './ot-attendance/ot-attendance.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { VariableAllowanceModule } from './variable-allowance/variable-allowance.module';
import { WageMasterModule } from './wage-master/wage-master.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    EmployeeModule,
    PrismaModule,
    AttendanceModule,
    OtAttendanceModule,
    OrganisationModule,
    WageMasterModule,
    VariableAllowanceModule,
    ManualDeductionModule,
    PayrollModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
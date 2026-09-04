import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { EmployeeReportsController } from './employee-reports.controller';
import { EmployeeReportsService } from './employee-reports.service';
import { EmployeeReportsRepository } from './repository/employee-reports.repository';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeReportsController],
  providers: [EmployeeReportsService, EmployeeReportsRepository],
})
export class EmployeeReportsModule {}

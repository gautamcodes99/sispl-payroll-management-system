import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { EmployeeController } from './controller/employee.controller';
import { EmployeeService } from './service/employee.service';
import { EmployeeRepository } from './repository/employee.repository';
import { EmployeeReportsModule } from './reports/employee-reports.module';

@Module({
  imports: [PrismaModule, EmployeeReportsModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeRepository],
  exports: [EmployeeService],
})
export class EmployeeModule {}

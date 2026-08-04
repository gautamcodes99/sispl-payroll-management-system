import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { EmployeeController } from './controller/employee.controller';
import { EmployeeService } from './service/employee.service';
import { EmployeeRepository } from './repository/employee.repository';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeRepository],
  exports: [EmployeeService],
})
export class EmployeeModule {}

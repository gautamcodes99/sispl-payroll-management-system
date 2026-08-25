import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollRepository } from './repository/payroll.repository';
import { PayrollCalculationService } from './payroll-calculation.service';
import { ComplianceCalculatorService } from './compliance/compliance-calculator.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollReportsController } from './reports/payroll-reports.controller';
import { PayrollReportsService } from './reports/payroll-reports.service';
import { PayrollReportsRepository } from './reports/repository/payroll-reports.repository';

@Module({
  imports: [PrismaModule],

  controllers: [PayrollController, PayrollReportsController],

  providers: [
    PayrollRepository,
    PayrollCalculationService,
    ComplianceCalculatorService,
    PayrollService,
    PayrollReportsRepository,
    PayrollReportsService,
  ],

  exports: [PayrollCalculationService, PayrollService],
})
export class PayrollModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollRepository } from './repository/payroll.repository';
import { PayrollCalculationService } from './payroll-calculation.service';
import { ComplianceCalculatorService } from './compliance/compliance-calculator.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PayrollController],
  providers: [
    PayrollRepository,
    PayrollCalculationService,
    ComplianceCalculatorService,
  ],
  exports: [PayrollCalculationService],
})
export class PayrollModule {}

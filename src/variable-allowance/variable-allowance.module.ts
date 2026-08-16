import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VariableAllowanceController } from './controller/variable-allowance.controller';
import { VariableAllowanceRepository } from './repository/variable-allowance.repository';
import { VariableAllowanceService } from './service/variable-allowance.service';

@Module({
  imports: [PrismaModule],
  controllers: [VariableAllowanceController],
  providers: [VariableAllowanceService, VariableAllowanceRepository],
  exports: [VariableAllowanceService],
})
export class VariableAllowanceModule {}

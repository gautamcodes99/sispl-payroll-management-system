import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ManualDeductionController } from './controller/manual-deduction.controller';
import { ManualDeductionRepository } from './repository/manual-deduction.repository';
import { ManualDeductionService } from './service/manual-deduction.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManualDeductionController],
  providers: [ManualDeductionService, ManualDeductionRepository],
  exports: [ManualDeductionService],
})
export class ManualDeductionModule {}

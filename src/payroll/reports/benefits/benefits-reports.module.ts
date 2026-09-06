import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { BenefitsReportsController } from './benefits-reports.controller';
import { BenefitsReportsService } from './benefits-reports.service';
import { BenefitsReportsRepository } from './repository/benefits-reports.repository';

@Module({
  imports: [PrismaModule],

  controllers: [BenefitsReportsController],

  providers: [BenefitsReportsService, BenefitsReportsRepository],
})
export class BenefitsReportsModule {}

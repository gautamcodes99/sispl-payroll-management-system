import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ComplianceReportsController } from './compliance-reports.controller';
import { ComplianceReportsService } from './compliance-reports.service';
import { ComplianceReportsRepository } from './repository/compliance-reports.repository';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceReportsController],
  providers: [ComplianceReportsService, ComplianceReportsRepository],
})
export class ComplianceReportsModule {}

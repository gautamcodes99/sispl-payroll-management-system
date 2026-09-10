import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CompanyProfileController } from './controller/company-profile.controller';
import { CompanyProfileRepository } from './repository/company-profile.repository';
import { CompanyProfileService } from './service/company-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService, CompanyProfileRepository],
  exports: [CompanyProfileService, CompanyProfileRepository],
})
export class CompanyProfileModule {}
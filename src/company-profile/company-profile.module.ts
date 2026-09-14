import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CompanyProfileController } from './controller/company-profile.controller';
import { CompanyProfileGalleryController } from './controller/company-profile-gallery.controller';
import { CompanyProfileGalleryRepository } from './repository/company-profile-gallery.repository';
import { CompanyProfileRepository } from './repository/company-profile.repository';
import { CompanyProfileGalleryService } from './service/company-profile-gallery.service';
import { CompanyProfileService } from './service/company-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    CompanyProfileController,
    CompanyProfileGalleryController,
  ],
  providers: [
    CompanyProfileService,
    CompanyProfileRepository,
    CompanyProfileGalleryService,
    CompanyProfileGalleryRepository,
  ],
  exports: [
    CompanyProfileService,
    CompanyProfileRepository,
    CompanyProfileGalleryService,
    CompanyProfileGalleryRepository,
  ],
})
export class CompanyProfileModule {}

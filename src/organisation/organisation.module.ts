import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { OrganisationController } from './controller/organisation.controller';
import { OrganisationService } from './service/organisation.service';
import { OrganisationRepository } from './repository/organisation.repository';

@Module({
  imports: [PrismaModule],
  controllers: [OrganisationController],
  providers: [OrganisationService, OrganisationRepository],
})
export class OrganisationModule {}

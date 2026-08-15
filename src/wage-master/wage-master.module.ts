import { Module } from '@nestjs/common';
import { WageMasterController } from './controller/wage-master.controller';
import { WageMasterRepository } from './repository/wage-master.repository';
import { WageMasterService } from './service/wage-master.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WageMasterController],
  providers: [WageMasterService, WageMasterRepository],
  exports: [WageMasterService],
})
export class WageMasterModule {}

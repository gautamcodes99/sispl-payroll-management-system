import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto';
import { CompanyProfileService } from '../service/company-profile.service';

@Controller('company-profile')
@Roles(UserRole.SUPER_ADMIN)
export class CompanyProfileController {
  constructor(
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  @Get()
  find() {
    return this.companyProfileService.find();
  }

  @Patch()
  update(@Body() updateCompanyProfileDto: UpdateCompanyProfileDto) {
    return this.companyProfileService.update(updateCompanyProfileDto);
  }
}
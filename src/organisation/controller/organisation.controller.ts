import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrganisationService } from '../service/organisation.service';
import { CreateSiteDto } from '../dto/create-site.dto';
import { UpdateSiteDto } from '../dto/update-site.dto';
import { UpdateStatusDto } from '../../common/dto/update-status.dto';
import { CreateWorkTypeDto } from '../dto/create-work-type.dto';

@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Post('sites')
  createSite(@Body() createSiteDto: CreateSiteDto) {
    return this.organisationService.createSite(createSiteDto);
  }
  @Get('sites/:id')
  findSiteById(@Param('id', ParseIntPipe) id: number) {
    return this.organisationService.findSiteById(id);
  }
  @Patch('sites/:id')
  updateSite(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.organisationService.updateSite(id, updateSiteDto);
  }
  @Patch('sites/:id/status')
  updateSiteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.organisationService.updateSiteStatus(id, updateStatusDto);
  }
  @Post('work-types')
  createWorkType(@Body() createWorkTypeDto: CreateWorkTypeDto) {
    return this.organisationService.createWorkType(createWorkTypeDto);
  }
}

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
import { UpdateWorkTypeDto } from '../dto/update-work-type.dto';
import { UpdateWorkTypeStatusDto } from '../dto/update-work-type-status.dto';

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
  @Get('work-types')
  findWorkTypes() {
    return this.organisationService.findWorkTypes();
  }
  @Get('work-types/:id')
  findWorkTypeById(@Param('id', ParseIntPipe) id: number) {
    return this.organisationService.findWorkTypeById(id);
  }
  @Patch('work-types/:id')
  updateWorkType(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkTypeDto: UpdateWorkTypeDto,
  ) {
    return this.organisationService.updateWorkType(id, updateWorkTypeDto);
  }
  @Patch('work-types/:id/status')
  updateWorkTypeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkTypeStatusDto: UpdateWorkTypeStatusDto,
  ) {
    return this.organisationService.updateWorkTypeStatus(
      id,
      updateWorkTypeStatusDto,
    );
  }
}

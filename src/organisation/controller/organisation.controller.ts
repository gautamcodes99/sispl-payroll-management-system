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
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { UpdateDepartmentStatusDto } from '../dto/update-department-status.dto';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { UpdateDesignationDto } from '../dto/update-designation.dto';
import { UpdateDesignationStatusDto } from '../dto/update-designation-status.dto';

@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Post('sites')
  createSite(@Body() createSiteDto: CreateSiteDto) {
    return this.organisationService.createSite(createSiteDto);
  }
  @Get('sites')
  findSites() {
    return this.organisationService.findSites();
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
  @Post('departments')
  createDepartment(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.organisationService.createDepartment(createDepartmentDto);
  }
  @Get('departments')
  findDepartments() {
    return this.organisationService.findDepartments();
  }
  @Get('departments/:id')
  findDepartmentById(@Param('id', ParseIntPipe) id: number) {
    return this.organisationService.findDepartmentById(id);
  }
  @Patch('departments/:id')
  updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.organisationService.updateDepartment(id, updateDepartmentDto);
  }
  @Patch('departments/:id/status')
  updateDepartmentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDepartmentStatusDto: UpdateDepartmentStatusDto,
  ) {
    return this.organisationService.updateDepartmentStatus(
      id,
      updateDepartmentStatusDto,
    );
  }
  @Post('designations')
  createDesignation(@Body() createDesignationDto: CreateDesignationDto) {
    return this.organisationService.createDesignation(createDesignationDto);
  }
  @Get('designations')
  findDesignations() {
    return this.organisationService.findDesignations();
  }
  @Get('designations/:id')
  findDesignationById(@Param('id', ParseIntPipe) id: number) {
    return this.organisationService.findDesignationById(id);
  }
  @Patch('designations/:id')
  updateDesignation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDesignationDto: UpdateDesignationDto,
  ) {
    return this.organisationService.updateDesignation(id, updateDesignationDto);
  }
  @Patch('designations/:id/status')
  updateDesignationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDesignationStatusDto: UpdateDesignationStatusDto,
  ) {
    return this.organisationService.updateDesignationStatus(
      id,
      updateDesignationStatusDto,
    );
  }
}

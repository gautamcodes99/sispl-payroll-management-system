import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { EmployeeService } from '../service/employee.service';

import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { UpdateEmployeeStatusDto } from '../dto/update-employee-status.dto';
import { UpdateEmployeeProfileDto } from '../dto/update-employee-profile.dto';
import { UpdateEmployeeAddressDto } from '../dto/update-employee-address.dto';
import { UpdateEmployeeBankDto } from '../dto/update-employee-bank.dto';
import { UpdateEmployeeStatutoryDto } from '../dto/update-employee-statutory.dto';
import { UpdateEmployeeNomineeDto } from '../dto/update-employee-nominee.dto';
import { UpdateEmployeeEmploymentDto } from '../dto/update-employee-employment.dto';
import { ImportEmployeesDto } from '../dto/import-employees.dto';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  // =========================================================
  // EMPLOYEE LIST
  // =========================================================

  @Get()
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employeeService.findEmployees(query);
  }

  // =========================================================
  // EMPLOYEE EXCEL IMPORT VALIDATION
  //
  // Validates the complete workbook payload.
  // Does not insert any employees.
  // =========================================================

  @Post('import/validate')
  validateImport(@Body() importEmployeesDto: ImportEmployeesDto) {
    return this.employeeService.validateImport(importEmployeesDto);
  }

  // =========================================================
  // EMPLOYEE EXCEL IMPORT
  //
  // Revalidates the complete workbook before insertion.
  // Import is all-or-nothing.
  // =========================================================

  @Post('import')
  importEmployees(@Body() importEmployeesDto: ImportEmployeesDto) {
    return this.employeeService.importEmployees(importEmployeesDto);
  }

  // =========================================================
  // EMPLOYEE EXCEL EXPORT
  //
  // Returns the complete Employee Master dataset.
  //
  // IMPORTANT:
  // This static route must remain before @Get(':id').
  // =========================================================

  @Get('export')
  exportEmployees() {
    return this.employeeService.exportEmployees();
  }

  // =========================================================
  // EMPLOYEE DETAIL
  // =========================================================

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.findEmployeeById(id);
  }

  // =========================================================
  // PROFILE
  // =========================================================

  @Patch(':id/profile')
  updateEmployeeProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeProfileDto: UpdateEmployeeProfileDto,
  ) {
    return this.employeeService.updateEmployeeProfile(
      id,
      updateEmployeeProfileDto,
    );
  }

  // =========================================================
  // EMPLOYMENT
  // =========================================================

  @Patch(':id/employment')
  updateEmployeeEmployment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeEmploymentDto: UpdateEmployeeEmploymentDto,
  ) {
    return this.employeeService.updateEmployeeEmployment(
      id,
      updateEmployeeEmploymentDto,
    );
  }

  // =========================================================
  // ADDRESS
  // =========================================================

  @Patch(':id/address')
  updateEmployeeAddress(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeAddressDto: UpdateEmployeeAddressDto,
  ) {
    return this.employeeService.updateEmployeeAddress(
      id,
      updateEmployeeAddressDto,
    );
  }

  // =========================================================
  // BANK DETAILS
  // =========================================================

  @Patch(':id/bank-details')
  updateEmployeeBankDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeBankDto: UpdateEmployeeBankDto,
  ) {
    return this.employeeService.updateEmployeeBankDetails(
      id,
      updateEmployeeBankDto,
    );
  }

  // =========================================================
  // STATUTORY DETAILS
  // =========================================================

  @Patch(':id/statutory-details')
  updateEmployeeStatutoryDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeStatutoryDto: UpdateEmployeeStatutoryDto,
  ) {
    return this.employeeService.updateEmployeeStatutoryDetails(
      id,
      updateEmployeeStatutoryDto,
    );
  }

  // =========================================================
  // NOMINEE
  // =========================================================

  @Patch(':id/nominee')
  updateEmployeeNominee(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeNomineeDto: UpdateEmployeeNomineeDto,
  ) {
    return this.employeeService.updateEmployeeNominee(
      id,
      updateEmployeeNomineeDto,
    );
  }

  // =========================================================
  // STATUS
  // =========================================================

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeStatusDto: UpdateEmployeeStatusDto,
  ) {
    return this.employeeService.updateEmployeeStatus(
      id,
      updateEmployeeStatusDto,
    );
  }

  // =========================================================
  // CREATE EMPLOYEE
  // =========================================================

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }
}

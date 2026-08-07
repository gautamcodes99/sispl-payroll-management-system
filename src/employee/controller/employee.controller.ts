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

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employeeService.findEmployees(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.findEmployeeById(id);
  }
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

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }
}

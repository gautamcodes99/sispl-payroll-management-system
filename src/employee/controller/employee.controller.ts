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
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

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
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.updateEmployee(id, updateEmployeeDto);
  }

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }
}

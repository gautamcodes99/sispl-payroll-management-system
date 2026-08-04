import { Injectable } from '@nestjs/common';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { EmployeeRepository } from '../repository/employee.repository';

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    const employee = await this.employeeRepository.create(createEmployeeDto);

    return {
      success: true,
      message: 'Employee created successfully.',
      data: employee,
    };
  }

  async findEmployees(query: EmployeeQueryDto) {
    const result = await this.employeeRepository.findEmployees(query);

    return {
      success: true,
      message: 'Employees fetched successfully.',
      data: result.employees,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
}

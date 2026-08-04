import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { EmployeeRepository } from '../repository/employee.repository';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

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
  async findEmployeeById(id: number) {
    const employee = await this.employeeRepository.findEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return {
      success: true,
      message: 'Employee fetched successfully.',
      data: employee,
    };
  }
  async updateEmployee(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    // Check if employee exists
    const employee = await this.employeeRepository.findEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    // Update employee
    const updatedEmployee = await this.employeeRepository.updateEmployee(
      id,
      updateEmployeeDto,
    );

    return {
      success: true,
      message: 'Employee updated successfully.',
      data: updatedEmployee,
    };
  }
}

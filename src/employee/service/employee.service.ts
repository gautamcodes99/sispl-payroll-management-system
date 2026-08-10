import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { EmployeeRepository } from '../repository/employee.repository';

import { UpdateEmployeeStatusDto } from '../dto/update-employee-status.dto';
import { UpdateEmployeeProfileDto } from '../dto/update-employee-profile.dto';
import { UpdateEmployeeAddressDto } from '../dto/update-employee-address.dto';
import { UpdateEmployeeBankDto } from '../dto/update-employee-bank.dto';
import { UpdateEmployeeStatutoryDto } from '../dto/update-employee-statutory.dto';
import { UpdateEmployeeNomineeDto } from '../dto/update-employee-nominee.dto';
import { UpdateEmployeeEmploymentDto } from '../dto/update-employee-employment.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  // =========================================================
  // CREATE
  // =========================================================

  async create(createEmployeeDto: CreateEmployeeDto) {
    const employee =
      await this.employeeRepository.createEmployee(createEmployeeDto);

    return {
      success: true,
      message: 'Employee created successfully.',
      data: employee,
    };
  }

  // =========================================================
  // LIST
  // =========================================================

  async findEmployees(query: EmployeeQueryDto) {
    const result = await this.employeeRepository.getEmployees(query);

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

  // =========================================================
  // DETAIL
  // =========================================================

  async findEmployeeById(id: number) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return {
      success: true,
      message: 'Employee fetched successfully.',
      data: employee,
    };
  }

  // =========================================================
  // PROFILE
  // =========================================================

  async updateEmployeeProfile(
    id: number,
    updateEmployeeProfileDto: UpdateEmployeeProfileDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const updatedEmployee = await this.employeeRepository.updateEmployeeProfile(
      id,
      updateEmployeeProfileDto,
    );

    return {
      success: true,
      message: 'Employee profile updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // EMPLOYMENT
  //
  // Locked fields:
  // - Designation
  // - Joining Date
  // - Basic Salary
  //
  // Site / Work Type / Department are NOT employee fields here.
  // =========================================================

  async updateEmployeeEmployment(
    id: number,
    updateEmployeeEmploymentDto: UpdateEmployeeEmploymentDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const { designationId, joiningDate, basicSalary } =
      updateEmployeeEmploymentDto;

    if (!Number.isInteger(designationId) || designationId <= 0) {
      throw new BadRequestException('A valid designation is required.');
    }

    if (!joiningDate) {
      throw new BadRequestException('Joining date is required.');
    }

    const parsedJoiningDate = new Date(joiningDate);

    if (Number.isNaN(parsedJoiningDate.getTime())) {
      throw new BadRequestException('Please enter a valid joining date.');
    }

    const salary = Number(basicSalary);

    if (!Number.isFinite(salary) || salary < 0) {
      throw new BadRequestException('Please enter a valid basic salary.');
    }

    const updatedEmployee =
      await this.employeeRepository.updateEmployeeEmployment(
        id,
        updateEmployeeEmploymentDto,
      );

    return {
      success: true,
      message: 'Employee employment details updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // ADDRESS
  // =========================================================

  async updateEmployeeAddress(
    id: number,
    updateEmployeeAddressDto: UpdateEmployeeAddressDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const updatedEmployee = await this.employeeRepository.updateEmployeeAddress(
      id,
      updateEmployeeAddressDto,
    );

    return {
      success: true,
      message: 'Employee address updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // BANK DETAILS
  // =========================================================

  async updateEmployeeBankDetails(
    id: number,
    updateEmployeeBankDto: UpdateEmployeeBankDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const updatedEmployee =
      await this.employeeRepository.updateEmployeeBankDetails(
        id,
        updateEmployeeBankDto,
      );

    return {
      success: true,
      message: 'Employee bank details updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // STATUTORY DETAILS
  // =========================================================

  async updateEmployeeStatutoryDetails(
    id: number,
    updateEmployeeStatutoryDto: UpdateEmployeeStatutoryDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const updatedEmployee =
      await this.employeeRepository.updateEmployeeStatutoryDetails(
        id,
        updateEmployeeStatutoryDto,
      );

    return {
      success: true,
      message: 'Employee statutory details updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // NOMINEE
  // =========================================================

  async updateEmployeeNominee(
    id: number,
    updateEmployeeNomineeDto: UpdateEmployeeNomineeDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const updatedEmployee = await this.employeeRepository.updateEmployeeNominee(
      id,
      updateEmployeeNomineeDto,
    );

    return {
      success: true,
      message: 'Employee nominee updated successfully.',
      data: updatedEmployee,
    };
  }

  // =========================================================
  // STATUS
  // =========================================================

  async updateEmployeeStatus(
    id: number,
    updateEmployeeStatusDto: UpdateEmployeeStatusDto,
  ) {
    const employee = await this.employeeRepository.getEmployeeById(id);

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const { status, leftReason, leftDate } = updateEmployeeStatusDto;

    if (status === 'INACTIVE') {
      if (!leftReason?.trim()) {
        throw new BadRequestException(
          'Reason of leaving is required when an employee is made inactive.',
        );
      }

      if (!leftDate) {
        throw new BadRequestException(
          'Date of leaving is required when an employee is made inactive.',
        );
      }
    }

    const updatedEmployee = await this.employeeRepository.updateEmployeeStatus(
      id,
      updateEmployeeStatusDto,
    );

    return {
      success: true,
      message: 'Employee status updated successfully.',
      data: updatedEmployee,
    };
  }
}

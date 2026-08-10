import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { UpdateEmployeeStatusDto } from '../dto/update-employee-status.dto';
import { UpdateEmployeeProfileDto } from '../dto/update-employee-profile.dto';
import { UpdateEmployeeEmploymentDto } from '../dto/update-employee-employment.dto';
import { UpdateEmployeeAddressDto } from '../dto/update-employee-address.dto';
import { UpdateEmployeeBankDto } from '../dto/update-employee-bank.dto';
import { UpdateEmployeeStatutoryDto } from '../dto/update-employee-statutory.dto';
import { UpdateEmployeeNomineeDto } from '../dto/update-employee-nominee.dto';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly employeeListSelect = {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    email: true,
    joiningDate: true,
    basicSalary: true,
    status: true,

    designation: {
      select: {
        id: true,
        designationName: true,
      },
    },
  } satisfies Prisma.EmployeeSelect;

  private readonly employeeDetailSelect = {
    id: true,

    // Personal Information
    photo: true,
    firstName: true,
    lastName: true,
    fatherName: true,
    dateOfBirth: true,
    gender: true,
    phone: true,
    email: true,

    // Employment
    joiningDate: true,
    basicSalary: true,
    status: true,
    leftReason: true,
    leftDate: true,

    designation: {
      select: {
        id: true,
        designationName: true,

        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
    },

    // Address
    presentAddress: true,
    permanentAddress: true,

    // Bank Details
    bankName: true,
    accountHolderName: true,
    accountNumber: true,
    ifscCode: true,

    // Statutory
    aadhaarNumber: true,
    panNumber: true,
    uanNumber: true,
    esicNumber: true,

    // Nominee
    nomineeName: true,
    nomineeRelationship: true,
    nomineeMobile: true,

    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.EmployeeSelect;

  async createEmployee(createEmployeeDto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        firstName: createEmployeeDto.firstName,
        lastName: createEmployeeDto.lastName,
        phone: createEmployeeDto.phone,
        joiningDate: new Date(createEmployeeDto.joiningDate),
        basicSalary: createEmployeeDto.basicSalary,

        designation: {
          connect: {
            id: createEmployeeDto.designationId,
          },
        },
      },

      select: this.employeeDetailSelect,
    });
  }

  async getEmployees(query: EmployeeQueryDto) {
    const { page, limit, search, designation, status, sortBy, order } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    if (designation) {
      where.designation = {
        designationName: designation,
      };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
        select: this.employeeListSelect,
      }),

      this.prisma.employee.count({
        where,
      }),
    ]);

    return {
      employees,
      total,
    };
  }

  async getEmployeeById(id: number) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeProfile(
    id: number,
    updateEmployeeProfileDto: UpdateEmployeeProfileDto,
  ) {
    const { dateOfBirth, ...rest } = updateEmployeeProfileDto;

    const data: Prisma.EmployeeUpdateInput = {
      ...rest,
    };

    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    }

    return this.prisma.employee.update({
      where: {
        id,
      },
      data,
      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeEmployment(
    id: number,
    updateEmployeeEmploymentDto: UpdateEmployeeEmploymentDto,
  ) {
    const { designationId, joiningDate, basicSalary } =
      updateEmployeeEmploymentDto;

    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        joiningDate: new Date(joiningDate),
        basicSalary,

        designation: {
          connect: {
            id: designationId,
          },
        },
      },

      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeAddress(
    id: number,
    updateEmployeeAddressDto: UpdateEmployeeAddressDto,
  ) {
    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        presentAddress: updateEmployeeAddressDto.presentAddress,
        permanentAddress: updateEmployeeAddressDto.permanentAddress,
      },

      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeBankDetails(
    id: number,
    updateEmployeeBankDto: UpdateEmployeeBankDto,
  ) {
    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        bankName: updateEmployeeBankDto.bankName,
        accountHolderName: updateEmployeeBankDto.accountHolderName,
        accountNumber: updateEmployeeBankDto.accountNumber,
        ifscCode: updateEmployeeBankDto.ifscCode,
      },

      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeStatutoryDetails(
    id: number,
    updateEmployeeStatutoryDto: UpdateEmployeeStatutoryDto,
  ) {
    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        aadhaarNumber: updateEmployeeStatutoryDto.aadhaarNumber,
        panNumber: updateEmployeeStatutoryDto.panNumber,
        uanNumber: updateEmployeeStatutoryDto.uanNumber,
        esicNumber: updateEmployeeStatutoryDto.esicNumber,
      },

      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeNominee(
    id: number,
    updateEmployeeNomineeDto: UpdateEmployeeNomineeDto,
  ) {
    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        nomineeName: updateEmployeeNomineeDto.nomineeName,
        nomineeRelationship: updateEmployeeNomineeDto.nomineeRelationship,
        nomineeMobile: updateEmployeeNomineeDto.nomineeMobile,
      },

      select: this.employeeDetailSelect,
    });
  }

  async updateEmployeeStatus(
    id: number,
    updateEmployeeStatusDto: UpdateEmployeeStatusDto,
  ) {
    const { status, leftReason, leftDate } = updateEmployeeStatusDto;

    return this.prisma.employee.update({
      where: {
        id,
      },

      data: {
        status,

        /*
         * When employee becomes ACTIVE again,
         * clear previous leaving information.
         */
        leftReason: status === 'ACTIVE' ? null : leftReason?.trim() || null,

        leftDate:
          status === 'ACTIVE' ? null : leftDate ? new Date(leftDate) : null,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        leftReason: true,
        leftDate: true,
      },
    });
  }
}

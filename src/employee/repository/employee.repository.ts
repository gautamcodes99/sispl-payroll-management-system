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
import { ImportEmployeeRowDto } from '../dto/import-employees.dto';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // EMPLOYEE LIST SELECT
  // =========================================================

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

  // =========================================================
  // EMPLOYEE DETAIL SELECT
  // =========================================================

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

  // =========================================================
  // CREATE EMPLOYEE
  // =========================================================

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

  // =========================================================
  // GET EMPLOYEES
  // =========================================================

  async getEmployees(query: EmployeeQueryDto) {
    const { page, limit, search, designation, status, sortBy, order } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    // =======================================================
    // DESIGNATION FILTER
    // =======================================================

    if (designation) {
      where.designation = {
        designationName: designation,
      };
    }

    // =======================================================
    // STATUS FILTER
    // =======================================================

    if (status) {
      where.status = status;
    }

    // =======================================================
    // EMPLOYEE SEARCH
    //
    // Supports:
    // 1. Employee ID
    // 2. First Name
    // 3. Last Name
    // 4. Email
    // 5. Phone
    // =======================================================

    if (search?.trim()) {
      const normalizedSearch = search.trim();

      const searchConditions: Prisma.EmployeeWhereInput[] = [
        {
          firstName: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },

        {
          lastName: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },

        {
          email: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },

        {
          phone: {
            contains: normalizedSearch,
            mode: 'insensitive',
          },
        },
      ];

      if (/^\d+$/.test(normalizedSearch)) {
        searchConditions.unshift({
          id: Number(normalizedSearch),
        });
      }

      where.OR = searchConditions;
    }

    // =======================================================
    // DATABASE QUERY
    // =======================================================

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

  // =========================================================
  // GET EMPLOYEE BY ID
  // =========================================================

  async getEmployeeById(id: number) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },

      select: this.employeeDetailSelect,
    });
  }

  // =========================================================
  // UPDATE EMPLOYEE PROFILE
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE EMPLOYMENT
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE ADDRESS
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE BANK DETAILS
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE STATUTORY DETAILS
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE NOMINEE
  // =========================================================

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

  // =========================================================
  // UPDATE EMPLOYEE STATUS
  // =========================================================

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

  // =========================================================
  // EMPLOYEE EXCEL EXPORT
  //
  // Complete Employee Master dataset.
  //
  // Photo is intentionally excluded from Excel.
  // Existing photo field/backend code remains untouched.
  // =========================================================

  async getEmployeesForExport() {
    return this.prisma.employee.findMany({
      orderBy: {
        id: 'asc',
      },

      select: {
        id: true,

        // Personal Information
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
      },
    });
  }

  // =========================================================
  // EMPLOYEE EXCEL IMPORT
  // =========================================================

  // ---------------------------------------------------------
  // ACTIVE DESIGNATIONS
  //
  // Employee import may only use an existing ACTIVE
  // company-wide Designation master.
  // ---------------------------------------------------------

  async findActiveDesignationsForImport() {
    return this.prisma.designation.findMany({
      where: {
        status: 'ACTIVE',
      },

      select: {
        id: true,
        designationName: true,
      },

      orderBy: {
        designationName: 'asc',
      },
    });
  }

  // ---------------------------------------------------------
  // EXISTING EMAILS
  //
  // Employee.email is currently the database-level unique
  // employee field.
  // ---------------------------------------------------------

  async findExistingEmployeeEmails(emails: string[]) {
    if (emails.length === 0) {
      return [];
    }

    return this.prisma.employee.findMany({
      where: {
        email: {
          in: emails,
        },
      },

      select: {
        id: true,
        email: true,
      },
    });
  }

  // ---------------------------------------------------------
  // ATOMIC ORDERED IMPORT
  //
  // 1. Complete validation occurs first.
  // 2. Any validation error prevents this method being called.
  // 3. All rows are created in one transaction.
  // 4. Rows are created sequentially in workbook order.
  // 5. PostgreSQL generates Employee IDs.
  // 6. Any database failure rolls back the complete import.
  // ---------------------------------------------------------

  async importEmployees(
    rows: Array<{
      row: ImportEmployeeRowDto;
      designationId: number;
      joiningDate: Date;
      dateOfBirth: Date | null;
      leftDate: Date | null;
    }>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const createdEmployees: Array<{
          id: number;
          firstName: string;
          lastName: string;
        }> = [];

        for (const item of rows) {
          const { row, designationId, joiningDate, dateOfBirth, leftDate } =
            item;

          const employee = await tx.employee.create({
            data: {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),

              fatherName: row.fatherName?.trim() || null,
              dateOfBirth,
              gender: row.gender?.trim() || null,

              phone: row.phone.trim(),
              email: row.email?.trim() || null,

              joiningDate,
              basicSalary: row.basicSalary,

              status: row.status ?? 'ACTIVE',

              leftReason:
                (row.status ?? 'ACTIVE') === 'ACTIVE'
                  ? null
                  : row.leftReason?.trim() || null,

              leftDate: (row.status ?? 'ACTIVE') === 'ACTIVE' ? null : leftDate,

              presentAddress: row.presentAddress?.trim() || null,
              permanentAddress: row.permanentAddress?.trim() || null,

              bankName: row.bankName?.trim() || null,
              accountHolderName: row.accountHolderName?.trim() || null,
              accountNumber: row.accountNumber?.trim() || null,
              ifscCode: row.ifscCode?.trim() || null,

              aadhaarNumber: row.aadhaarNumber?.trim() || null,
              panNumber: row.panNumber?.trim() || null,
              uanNumber: row.uanNumber?.trim() || null,
              esicNumber: row.esicNumber?.trim() || null,

              nomineeName: row.nomineeName?.trim() || null,
              nomineeRelationship: row.nomineeRelationship?.trim() || null,
              nomineeMobile: row.nomineeMobile?.trim() || null,

              designation: {
                connect: {
                  id: designationId,
                },
              },
            },

            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          });

          createdEmployees.push(employee);
        }

        return createdEmployees;
      },
      {
        maxWait: 10000,
        timeout: 120000,
      },
    );
  }
}

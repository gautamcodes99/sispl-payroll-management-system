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
import {
  ImportEmployeeRowDto,
  ImportEmployeesDto,
} from '../dto/import-employees.dto';

type EmployeeImportError = {
  rowNumber: number;
  employeeName: string;
  field: string;
  value: string;
  message: string;
};

type ValidatedEmployeeImportRow = {
  row: ImportEmployeeRowDto;
  designationId: number;
  joiningDate: Date;
  dateOfBirth: Date | null;
  leftDate: Date | null;
};

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
  // =========================================================
  // EMPLOYEE EXCEL EXPORT
  //
  // Complete Employee Master export.
  // No pagination is applied.
  // =========================================================

  async exportEmployees() {
    const employees = await this.employeeRepository.getEmployeesForExport();

    return {
      success: true,
      message: 'Employee export data fetched successfully.',
      data: employees,
      total: employees.length,
    };
  }
  // =========================================================
  // EMPLOYEE EXCEL IMPORT
  // =========================================================

  private importValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value).trim();
  }

  private parseImportDate(value: string | undefined): Date | null {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    // YYYY-MM-DD
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);

      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return date;
      }

      return null;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const displayMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(normalized);

    if (displayMatch) {
      const day = Number(displayMatch[1]);
      const month = Number(displayMatch[2]);
      const year = Number(displayMatch[3]);

      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return date;
      }
    }

    return null;
  }

  private addImportError(
    errors: EmployeeImportError[],
    row: ImportEmployeeRowDto,
    field: string,
    value: unknown,
    message: string,
  ) {
    errors.push({
      rowNumber: row.rowNumber,
      employeeName:
        `${row.firstName?.trim() || ''} ${row.lastName?.trim() || ''}`.trim(),
      field,
      value: this.importValue(value),
      message,
    });
  }

  private async validateEmployeeImport(importEmployeesDto: ImportEmployeesDto) {
    const rows = importEmployeesDto.employees;

    const errors: EmployeeImportError[] = [];

    const activeDesignations =
      await this.employeeRepository.findActiveDesignationsForImport();

    const designationMap = new Map(
      activeDesignations.map((designation) => [
        designation.designationName.trim().toLowerCase(),
        designation,
      ]),
    );

    // =======================================================
    // EXISTING EMAIL LOOKUP
    // =======================================================

    const workbookEmails = Array.from(
      new Set(
        rows
          .map((row) => row.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    const existingEmployees =
      await this.employeeRepository.findExistingEmployeeEmails(workbookEmails);

    const existingEmailMap = new Map(
      existingEmployees
        .filter((employee): employee is typeof employee & { email: string } =>
          Boolean(employee.email),
        )
        .map((employee) => [employee.email.toLowerCase(), employee.id]),
    );

    // =======================================================
    // DUPLICATE EMAILS INSIDE WORKBOOK
    // =======================================================

    const workbookEmailRows = new Map<string, number[]>();

    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();

      if (!email) {
        continue;
      }

      const rowNumbers = workbookEmailRows.get(email) ?? [];

      rowNumbers.push(row.rowNumber);

      workbookEmailRows.set(email, rowNumbers);
    }

    const validatedRows: ValidatedEmployeeImportRow[] = [];

    // =======================================================
    // ROW VALIDATION
    // =======================================================

    for (const row of rows) {
      const firstName = row.firstName?.trim();
      const lastName = row.lastName?.trim();
      const phone = row.phone?.trim();
      const designationName = row.designation?.trim();

      if (!Number.isInteger(row.rowNumber) || row.rowNumber < 2) {
        this.addImportError(
          errors,
          row,
          'Row Number',
          row.rowNumber,
          'Excel row number is invalid.',
        );
      }

      if (!firstName) {
        this.addImportError(
          errors,
          row,
          'First Name',
          row.firstName,
          'First Name is required.',
        );
      }

      if (!lastName) {
        this.addImportError(
          errors,
          row,
          'Last Name',
          row.lastName,
          'Last Name is required.',
        );
      }

      if (!phone) {
        this.addImportError(
          errors,
          row,
          'Phone Number',
          row.phone,
          'Phone Number is required.',
        );
      }

      // -----------------------------------------------------
      // DESIGNATION
      // -----------------------------------------------------

      const designation = designationName
        ? designationMap.get(designationName.toLowerCase())
        : undefined;

      if (!designationName) {
        this.addImportError(
          errors,
          row,
          'Designation',
          row.designation,
          'Designation is required.',
        );
      } else if (!designation) {
        this.addImportError(
          errors,
          row,
          'Designation',
          row.designation,
          `Designation "${designationName}" does not exist or is inactive.`,
        );
      }

      // -----------------------------------------------------
      // JOINING DATE
      // -----------------------------------------------------

      const joiningDate = this.parseImportDate(row.joiningDate);

      if (!row.joiningDate?.trim()) {
        this.addImportError(
          errors,
          row,
          'Joining Date',
          row.joiningDate,
          'Joining Date is required.',
        );
      } else if (!joiningDate) {
        this.addImportError(
          errors,
          row,
          'Joining Date',
          row.joiningDate,
          'Joining Date must be a valid DD-MM-YYYY or YYYY-MM-DD date.',
        );
      }

      // -----------------------------------------------------
      // DATE OF BIRTH
      // -----------------------------------------------------

      const dateOfBirth = this.parseImportDate(row.dateOfBirth);

      if (row.dateOfBirth?.trim() && !dateOfBirth) {
        this.addImportError(
          errors,
          row,
          'Date of Birth',
          row.dateOfBirth,
          'Date of Birth must be a valid DD-MM-YYYY or YYYY-MM-DD date.',
        );
      }

      // -----------------------------------------------------
      // BASIC SALARY
      // -----------------------------------------------------

      const basicSalary = Number(row.basicSalary);

      if (!Number.isFinite(basicSalary) || basicSalary < 0) {
        this.addImportError(
          errors,
          row,
          'Basic Salary',
          row.basicSalary,
          'Basic Salary must be a valid number greater than or equal to 0.',
        );
      }

      // -----------------------------------------------------
      // EMAIL
      // -----------------------------------------------------

      const email = row.email?.trim().toLowerCase();

      if (email) {
        const existingEmployeeId = existingEmailMap.get(email);

        if (existingEmployeeId !== undefined) {
          this.addImportError(
            errors,
            row,
            'Email',
            row.email,
            `Email already belongs to Employee ID ${existingEmployeeId}.`,
          );
        }

        const duplicateRows = workbookEmailRows.get(email) ?? [];

        if (duplicateRows.length > 1) {
          this.addImportError(
            errors,
            row,
            'Email',
            row.email,
            `Duplicate email in import file. Also used in Excel row(s): ${duplicateRows
              .filter((rowNumber) => rowNumber !== row.rowNumber)
              .join(', ')}.`,
          );
        }
      }

      // -----------------------------------------------------
      // STATUS / LEAVING DETAILS
      // -----------------------------------------------------

      const status = row.status ?? 'ACTIVE';

      const leftDate = this.parseImportDate(row.leftDate);

      if (row.leftDate?.trim() && !leftDate) {
        this.addImportError(
          errors,
          row,
          'Date of Leaving',
          row.leftDate,
          'Date of Leaving must be a valid DD-MM-YYYY or YYYY-MM-DD date.',
        );
      }

      if (status !== 'ACTIVE') {
        if (!row.leftReason?.trim()) {
          this.addImportError(
            errors,
            row,
            'Reason of Leaving',
            row.leftReason,
            'Reason of Leaving is required for a non-active employee.',
          );
        }

        if (!row.leftDate?.trim()) {
          this.addImportError(
            errors,
            row,
            'Date of Leaving',
            row.leftDate,
            'Date of Leaving is required for a non-active employee.',
          );
        }
      }

      // -----------------------------------------------------
      // ONLY BUILD IMPORT ROW WHEN REQUIRED RELATION / DATE
      // VALUES CAN BE RESOLVED.
      //
      // The complete file still fails if ANY error exists.
      // -----------------------------------------------------

      if (designation && joiningDate) {
        validatedRows.push({
          row: {
            ...row,
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || '',
            email: row.email?.trim() || undefined,
            designation: designationName || '',
            basicSalary,
          },
          designationId: designation.id,
          joiningDate,
          dateOfBirth,
          leftDate,
        });
      }
    }

    return {
      totalRows: rows.length,
      errors,
      validatedRows,
    };
  }

  // =========================================================
  // VALIDATE IMPORT
  //
  // This endpoint performs NO INSERTS.
  // =========================================================

  async validateImport(importEmployeesDto: ImportEmployeesDto) {
    const validation = await this.validateEmployeeImport(importEmployeesDto);

    if (validation.errors.length > 0) {
      throw new BadRequestException({
        message:
          'Employee import validation failed. No employees were imported.',
        totalRows: validation.totalRows,
        errorCount: validation.errors.length,
        errors: validation.errors,
      });
    }

    return {
      success: true,
      message: 'Employee import file is valid.',
      data: {
        totalRows: validation.totalRows,
        validRows: validation.totalRows,
        errorCount: 0,
      },
    };
  }

  // =========================================================
  // IMPORT
  //
  // Revalidates the COMPLETE file before inserting anything.
  // =========================================================

  async importEmployees(importEmployeesDto: ImportEmployeesDto) {
    const validation = await this.validateEmployeeImport(importEmployeesDto);

    if (validation.errors.length > 0) {
      throw new BadRequestException({
        message:
          'Employee import validation failed. No employees were imported.',
        totalRows: validation.totalRows,
        errorCount: validation.errors.length,
        errors: validation.errors,
      });
    }

    const employees = await this.employeeRepository.importEmployees(
      validation.validatedRows,
    );

    return {
      success: true,
      message: `${employees.length} employees imported successfully.`,
      data: {
        importedCount: employees.length,
        firstEmployeeId: employees[0]?.id ?? null,
        lastEmployeeId: employees[employees.length - 1]?.id ?? null,
        employees,
      },
    };
  }
}

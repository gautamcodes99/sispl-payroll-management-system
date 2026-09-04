import { BadRequestException, Injectable } from '@nestjs/common';

import { JoiningRegisterQueryDto } from './dto/joining-register-query.dto';
import { LeftEmployeeReportQueryDto } from './dto/left-employee-report-query.dto';
import { EmployeeReportsRepository } from './repository/employee-reports.repository';

@Injectable()
export class EmployeeReportsService {
  constructor(
    private readonly employeeReportsRepository: EmployeeReportsRepository,
  ) {}

  // =========================================================
  // DATE HELPERS
  // =========================================================

  private parseDateOnly(value: string, fieldName: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(
        `${fieldName} must be in YYYY-MM-DD format.`,
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} is not a valid date.`);
    }

    return date;
  }

  private addUtcDays(date: Date, days: number): Date {
    const result = new Date(date);

    result.setUTCDate(result.getUTCDate() + days);

    return result;
  }

  private employeeName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  // =========================================================
  // JOINING REGISTER
  //
  // Filter:
  // - month = YYYY-MM-01
  //
  // Selection:
  // - Employee.joiningDate falls within that calendar month.
  //
  // Aadhaar Name and Voter ID are intentionally blank because
  // Employee Master currently has no source fields for them.
  // =========================================================

  async getJoiningRegister(query: JoiningRegisterQueryDto) {
    const selectedMonth = this.parseDateOnly(query.month, 'Month');

    if (selectedMonth.getUTCDate() !== 1) {
      throw new BadRequestException(
        'Month must be the first day of the month in YYYY-MM-01 format.',
      );
    }

    const year = selectedMonth.getUTCFullYear();
    const monthIndex = selectedMonth.getUTCMonth();

    const fromDate = new Date(Date.UTC(year, monthIndex, 1));
    const toDateExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));

    const employees =
      await this.employeeReportsRepository.getJoiningRegisterEmployees(
        fromDate,
        toDateExclusive,
      );

    return {
      success: true,
      message: 'Joining Register fetched successfully.',
      data: {
        reportType: 'JOINING_REGISTER',
        month: query.month,
        employeeCount: employees.length,

        employees: employees.map((employee, index) => {
          const gender = employee.gender?.trim().toUpperCase() ?? '';
          const maritalStatus =
            employee.maritalStatus?.trim().toUpperCase() ?? '';

          const isMarriedFemale =
            gender === 'FEMALE' && maritalStatus === 'MARRIED';

          return {
            sno: index + 1,
            employeeId: employee.id,
            employeeName: this.employeeName(
              employee.firstName,
              employee.lastName,
            ),

            // Locked blank columns.
            aadhaarName: '',

            birthDate: employee.dateOfBirth,
            gender: employee.gender,

            fatherOrHusbandName: isMarriedFemale
              ? employee.husbandName
              : employee.fatherName,

            // Locked mapping from Employee Nominee details.
            relation: employee.nomineeRelationship,

            joiningDate: employee.joiningDate,
            dateOfLeaving: employee.leftDate,

            employeeAddress: employee.permanentAddress,

            nomineeName: employee.nomineeName,
            relationWithEmployee: employee.nomineeRelationship,

            aadhaarNumber: employee.aadhaarNumber,
            panNumber: employee.panNumber,

            // Locked blank column.
            voterId: '',

            mobileNumber: employee.phone,
          };
        }),
      },
    };
  }

  // =========================================================
  // LEFT EMPLOYEE REPORT
  //
  // Filter:
  // - inclusive From Date -> To Date
  //
  // Selection:
  // - Employee.leftDate only.
  //
  // Employee.status is display-only and does not control
  // inclusion in this report.
  // =========================================================

  async getLeftEmployeeReport(query: LeftEmployeeReportQueryDto) {
    const fromDate = this.parseDateOnly(query.fromDate, 'From Date');
    const toDate = this.parseDateOnly(query.toDate, 'To Date');

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('From Date cannot be later than To Date.');
    }

    const toDateExclusive = this.addUtcDays(toDate, 1);

    const employees = await this.employeeReportsRepository.getLeftEmployees(
      fromDate,
      toDateExclusive,
    );

    return {
      success: true,
      message: 'Left Employee Report fetched successfully.',
      data: {
        reportType: 'LEFT_EMPLOYEE_REPORT',
        fromDate: query.fromDate,
        toDate: query.toDate,
        employeeCount: employees.length,

        employees: employees.map((employee, index) => ({
          sno: index + 1,
          employeeId: employee.id,
          uanNumber: employee.uanNumber,
          esicNumber: employee.esicNumber,

          employeeName: this.employeeName(
            employee.firstName,
            employee.lastName,
          ),

          gender: employee.gender,
          designation: employee.designation.designationName,
          joiningDate: employee.joiningDate,

          // Existing Employee.leftDate is the report's
          // Last Working Date / Date of Leaving.
          lastWorkingDate: employee.leftDate,

          // Current Employee Master status, display only.
          status: employee.status,
        })),
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeeReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // JOINING REGISTER
  //
  // Returns employees whose Joining Date falls inside the
  // requested calendar month.
  //
  // Employee lifecycle reports read directly from Employee
  // Master. They do not depend on Attendance or Payroll.
  // =========================================================

  async getJoiningRegisterEmployees(fromDate: Date, toDateExclusive: Date) {
    return this.prisma.employee.findMany({
      where: {
        joiningDate: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },

      orderBy: [
        {
          joiningDate: 'asc',
        },
        {
          id: 'asc',
        },
      ],

      select: {
        id: true,

        firstName: true,
        lastName: true,

        dateOfBirth: true,
        gender: true,
        fatherName: true,
        maritalStatus: true,
        husbandName: true,

        joiningDate: true,
        leftDate: true,

        permanentAddress: true,

        nomineeName: true,
        nomineeRelationship: true,

        aadhaarNumber: true,
        panNumber: true,
        phone: true,
      },
    });
  }

  // =========================================================
  // LEFT EMPLOYEE REPORT
  //
  // Selection is based ONLY on Last Working Date / leftDate.
  //
  // Current Employee status is returned for display, but it
  // is intentionally NOT used as an inclusion filter.
  // =========================================================

  async getLeftEmployees(fromDate: Date, toDateExclusive: Date) {
    const where: Prisma.EmployeeWhereInput = {
      leftDate: {
        gte: fromDate,
        lt: toDateExclusive,
      },
    };

    return this.prisma.employee.findMany({
      where,

      orderBy: [
        {
          leftDate: 'asc',
        },
        {
          id: 'asc',
        },
      ],

      select: {
        id: true,

        uanNumber: true,
        esicNumber: true,

        firstName: true,
        lastName: true,
        gender: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },

        joiningDate: true,
        leftDate: true,

        // Display-only current Employee Master status.
        status: true,
      },
    });
  }
}

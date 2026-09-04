import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';

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
  // Joining Register is based directly on Employee Master.
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
  // Locked workflow:
  //
  // 1. Determine the employee's latest qualifying attendance
  //    across ALL Daily Attendance history.
  //
  // 2. Qualifying attendance statuses:
  //    - PRESENT
  //    - HALF_DAY
  //    - PAID_HOLIDAY
  //
  // 3. ABSENT and WEEKLY_OFF do NOT qualify.
  //
  // 4. Employee.status does NOT control inclusion.
  //
  // 5. If Employee.leftDate exists, that confirmed HR date
  //    takes priority in the Service.
  //
  // This repository intentionally does NOT filter employees by
  // the requested report date range. The Service applies the
  // final From Date -> To Date filter only after deciding the
  // actual displayed Last Working Date.
  // =========================================================

  async getLeftEmployees() {
    const qualifyingStatuses: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PAID_HOLIDAY,
    ];

    const lastAttendanceByEmployee = await this.prisma.attendance.groupBy({
      by: ['employeeId'],

      where: {
        status: {
          in: qualifyingStatuses,
        },
      },

      _max: {
        attendanceDate: true,
      },
    });

    const lastWorkingDateByEmployeeId = new Map<number, Date>();

    for (const row of lastAttendanceByEmployee) {
      if (row._max.attendanceDate) {
        lastWorkingDateByEmployeeId.set(
          row.employeeId,
          row._max.attendanceDate,
        );
      }
    }

    const attendanceEmployeeIds = Array.from(
      lastWorkingDateByEmployeeId.keys(),
    );

    const employees = await this.prisma.employee.findMany({
      where: {
        OR: [
          {
            id: {
              in: attendanceEmployeeIds,
            },
          },
          {
            leftDate: {
              not: null,
            },
          },
        ],
      },

      orderBy: {
        id: 'asc',
      },

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

        // Confirmed HR Date of Leaving, when already exited.
        leftDate: true,

        // Actual current Employee Master status.
        status: true,
      },
    });

    return employees.map((employee) => ({
      ...employee,

      attendanceDerivedLastWorkingDate:
        lastWorkingDateByEmployeeId.get(employee.id) ?? null,
    }));
  }
}

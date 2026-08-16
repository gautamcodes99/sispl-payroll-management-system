import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // EMPLOYEE
  // =========================================================

  async findEmployeeById(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
      include: {
        designation: {
          include: {
            site: true,
          },
        },
      },
    });
  }

  // =========================================================
  // COMPANY-WIDE MONTHLY PAYROLL EMPLOYEES
  //
  // Include:
  //
  // 1. All currently ACTIVE employees.
  //
  // 2. Employees who have payroll-relevant attendance during
  //    the requested wage month even if their current status
  //    is later INACTIVE / RESIGNED / TERMINATED.
  //
  // Payroll-relevant attendance:
  // PRESENT
  // HALF_DAY
  // PAID_HOLIDAY
  // =========================================================

  async findMonthlyPayrollEmployees(
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    const payrollStatuses: AttendanceStatus[] = [
      'PRESENT',
      'HALF_DAY',
      'PAID_HOLIDAY',
    ];

    return this.prisma.employee.findMany({
      where: {
        OR: [
          {
            status: 'ACTIVE',
          },
          {
            attendances: {
              some: {
                attendanceDate: {
                  gte: periodStart,
                  lt: periodEndExclusive,
                },
                status: {
                  in: payrollStatuses,
                },
              },
            },
          },
        ],
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
      },

      orderBy: {
        id: 'asc',
      },
    });
  }

  // =========================================================
  // APPLICABLE WAGE MASTER
  //
  // Wage period is one calendar month.
  //
  // The Wage Master applicable on the first day of the
  // salary month is used for that monthly wage period.
  //
  // Historical SUPERSEDED Wage Masters remain valid for
  // historical payroll where their effective period covers
  // the requested salary month.
  // =========================================================

  async findApplicableWageMaster(designationId: number, salaryMonth: Date) {
    return this.prisma.wageMaster.findFirst({
      where: {
        designationId,

        effectiveFrom: {
          lte: salaryMonth,
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gte: salaryMonth,
            },
          },
        ],

        status: {
          in: ['ACTIVE', 'SUPERSEDED'],
        },
      },

      include: {
        designation: {
          include: {
            site: true,
          },
        },

        specialAllowances: {
          orderBy: {
            minDays: 'asc',
          },
        },
      },

      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }

  // =========================================================
  // MONTHLY ATTENDANCE
  // =========================================================

  async findMonthlyAttendance(
    employeeId: number,
    periodStart: Date,
    periodEndExclusive: Date,
  ) {
    return this.prisma.attendance.findMany({
      where: {
        employeeId,

        attendanceDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
      },

      select: {
        attendanceDate: true,
        status: true,
        shift: true,
        otHours: true,
      },

      orderBy: {
        attendanceDate: 'asc',
      },
    });
  }

  // =========================================================
  // VARIABLE ALLOWANCE
  // =========================================================

  async findVariableAllowance(employeeId: number, salaryMonth: Date) {
    return this.prisma.variableAllowance.findUnique({
      where: {
        employeeId_salaryMonth: {
          employeeId,
          salaryMonth,
        },
      },
    });
  }

  // =========================================================
  // MANUAL DEDUCTION
  // =========================================================

  async findManualDeduction(employeeId: number, salaryMonth: Date) {
    return this.prisma.manualDeduction.findUnique({
      where: {
        employeeId_salaryMonth: {
          employeeId,
          salaryMonth,
        },
      },
    });
  }
}

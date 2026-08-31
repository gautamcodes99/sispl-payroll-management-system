import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';
import { AttendanceShift, Prisma } from '@prisma/client';
import { AttendanceReportQueryDto } from '../dto/attendance-report-query.dto';
import { FormXxiiiReportQueryDto } from '../dto/form-xxiii-report-query.dto';
import { MusterCutFileQueryDto } from '../dto/muster-cut-file-query.dto';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // ATTENDANCE LIST SELECT
  //
  // // Locked organisation architecture:
  //
  // Site
  // └── Work Type
  //     └── Department
  //
  // Designation is a company-wide master.
  // Employee belongs to Designation.
  //
  // Attendance stores Department so the operational
  // Department / Work Type / Site context survives refresh.
  //
  // Attendance -> Department -> Work Type -> Site
  // Employee   -> Designation
  // =========================================================

  private readonly attendanceListSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    shift: true,
    remarks: true,
    designation: {
      select: {
        id: true,
        designationName: true,
      },
    },

    department: {
      select: {
        id: true,
        departmentName: true,

        workType: {
          select: {
            id: true,
            workTypeName: true,

            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
    },

    employee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
      },
    },
  };

  // =========================================================
  // ATTENDANCE DETAIL SELECT
  // =========================================================

  private readonly attendanceDetailSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    shift: true,
    remarks: true,
    createdAt: true,
    updatedAt: true,
    designation: {
      select: {
        id: true,
        designationName: true,
      },
    },

    department: {
      select: {
        id: true,
        departmentName: true,

        workType: {
          select: {
            id: true,
            workTypeName: true,

            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
    },

    employee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
      },
    },
  };

  // =========================================================
  // EMPLOYEE ATTENDANCE CONTEXT
  //
  // Used by Service business validation.
  // =========================================================

  async findEmployeeAttendanceContext(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
      },
    });
  }

  // =========================================================
  // BULK EMPLOYEE ATTENDANCE CONTEXT
  //
  // Used by Service business validation.
  // =========================================================

  async findEmployeesAttendanceContext(employeeIds: number[]) {
    return this.prisma.employee.findMany({
      where: {
        id: {
          in: employeeIds,
        },
      },

      select: {
        id: true,
      },
    });
  }
  // =========================================================
  // WORKED DESIGNATION CONTEXT
  //
  // Attendance designation is operational for this entry.
  // It does NOT need to equal Employee.designationId.
  // =========================================================

  async findDesignationAttendanceContext(designationId: number) {
    return this.prisma.designation.findUnique({
      where: {
        id: designationId,
      },

      select: {
        id: true,
        designationName: true,
        status: true,
      },
    });
  }

  // =========================================================
  // DEPARTMENT ATTENDANCE CONTEXT
  //
  // Department -> Work Type -> Site
  //
  // Used by Service business validation.
  // =========================================================

  async findDepartmentAttendanceContext(departmentId: number) {
    return this.prisma.department.findUnique({
      where: {
        id: departmentId,
      },

      select: {
        id: true,
        departmentName: true,

        workType: {
          select: {
            id: true,
            workTypeName: true,
            siteId: true,

            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
    });
  }
  // =========================================================
  // FINALIZED PAYROLL RUN FOR MONTH
  //
  // Used by Attendance Service to enforce the locked rule:
  //
  // FINALIZED payroll month = Attendance locked
  // UNLOCKED payroll month  = Attendance editable
  //
  // SUPERSEDED historical runs do not lock Attendance.
  // =========================================================

  async findFinalizedPayrollRunForMonth(salaryMonth: Date) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: 'FINALIZED',
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        version: true,
        salaryMonth: true,
        status: true,
      },
    });
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(createAttendanceDto: CreateAttendanceDto) {
    return this.prisma.attendance.create({
      data: {
        employee: {
          connect: {
            id: createAttendanceDto.employeeId,
          },
        },

        department: {
          connect: {
            id: createAttendanceDto.departmentId,
          },
        },
        designation: {
          connect: {
            id: createAttendanceDto.designationId,
          },
        },

        attendanceDate: new Date(createAttendanceDto.attendanceDate),

        status: createAttendanceDto.status,

        shift: createAttendanceDto.shift,

        remarks: createAttendanceDto.remarks,
      },

      select: this.attendanceDetailSelect,
    });
  }

  // =========================================================
  // FIND ATTENDANCES
  // =========================================================

  async findAttendances(query: AttendanceQueryDto) {
    const {
      page,
      limit,
      attendanceDate,
      status,
      siteId,
      workTypeId,
      departmentId,
      designationId,
      search,
      shift,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {};

    // =======================================================
    // ATTENDANCE DATE
    // =======================================================

    if (attendanceDate) {
      const date = new Date(attendanceDate);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      where.attendanceDate = {
        gte: date,
        lt: nextDate,
      };
    }

    // =======================================================
    // STATUS
    // =======================================================

    if (status) {
      where.status = status;
    }

    // =======================================================
    // SHIFT
    // =======================================================

    if (shift) {
      where.shift = shift;
    }

    // =======================================================
    // ATTENDANCE ORGANISATION CONTEXT
    //
    // Attendance -> Department -> Work Type -> Site
    // =======================================================

    if (departmentId) {
      where.departmentId = departmentId;
    } else if (workTypeId) {
      where.department = {
        workTypeId,
      };
    } else if (siteId) {
      where.department = {
        workType: {
          siteId,
        },
      };
    }

    // =======================================================
    // WORKED DESIGNATION FILTER
    //
    // Attendance.designationId is the operational designation
    // selected for this attendance entry.
    // It is independent of Employee.designationId, which remains
    // the employee's master/payroll designation.
    // =======================================================

    if (designationId) {
      where.designationId = designationId;
    }

    // =======================================================
    // EMPLOYEE SEARCH
    // =======================================================

    if (search) {
      const employeeWhere: Prisma.EmployeeWhereInput = {};

      if (search) {
        employeeWhere.OR = [
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
        ];
      }

      where.employee = employeeWhere;
    }

    // =======================================================
    // QUERY
    // =======================================================

    const [attendances, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,

        skip,

        take: limit,

        orderBy: {
          attendanceDate: 'desc',
        },

        select: this.attendanceListSelect,
      }),

      this.prisma.attendance.count({
        where,
      }),
    ]);

    return {
      attendances,
      total,
    };
  }

  // =========================================================
  // PENDING EMPLOYEES
  // =========================================================

  async findPendingEmployees(attendanceDate: Date) {
    const date = new Date(attendanceDate);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    return this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',

        attendances: {
          none: {
            attendanceDate: {
              gte: date,
              lt: nextDate,
            },
          },
        },
      },

      orderBy: [
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
      ],

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
      },
    });
  }

  // =========================================================
  // DASHBOARD SUMMARY
  // =========================================================

  async getDashboardSummary(attendanceDate: Date) {
    const date = new Date(attendanceDate);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [
      totalEmployees,
      present,
      absent,
      leave,
      holiday,
      weeklyOff,
      halfDay,
      paidHoliday,
      pending,
    ] = await Promise.all([
      // -----------------------------------------------------
      // TOTAL ACTIVE EMPLOYEES
      // -----------------------------------------------------

      this.prisma.employee.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      // -----------------------------------------------------
      // PRESENT
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'PRESENT',
        },
      }),

      // -----------------------------------------------------
      // ABSENT
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'ABSENT',
        },
      }),

      // -----------------------------------------------------
      // LEAVE
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'LEAVE',
        },
      }),

      // -----------------------------------------------------
      // HOLIDAY
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'HOLIDAY',
        },
      }),

      // -----------------------------------------------------
      // WEEKLY OFF
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'WEEKLY_OFF',
        },
      }),

      // -----------------------------------------------------
      // HALF DAY
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'HALF_DAY',
        },
      }),

      // -----------------------------------------------------
      // PAID HOLIDAY
      // -----------------------------------------------------

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'PAID_HOLIDAY',
        },
      }),

      // -----------------------------------------------------
      // PENDING
      // -----------------------------------------------------

      this.prisma.employee.count({
        where: {
          status: 'ACTIVE',

          attendances: {
            none: {
              attendanceDate: {
                gte: date,
                lt: nextDate,
              },
            },
          },
        },
      }),
    ]);

    return {
      totalEmployees,
      present,
      absent,
      leave,
      holiday,
      weeklyOff,
      halfDay,
      paidHoliday,
      pending,
    };
  }

  // =========================================================
  // FIND EXISTING ATTENDANCE
  // =========================================================

  async findExistingAttendance(
    attendanceDate: Date,
    employeeIds: number[],
    shift: AttendanceShift,
  ) {
    return this.prisma.attendance.findMany({
      where: {
        attendanceDate,

        shift,

        employeeId: {
          in: employeeIds,
        },
      },

      select: {
        employeeId: true,
        shift: true,

        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // =========================================================
  // BULK CREATE ATTENDANCE
  // =========================================================

  async bulkCreateAttendance(bulkAttendanceDto: BulkAttendanceDto) {
    const attendanceDate = new Date(bulkAttendanceDto.attendanceDate);

    return this.prisma.$transaction(
      bulkAttendanceDto.employeeIds.map((employeeId) =>
        this.prisma.attendance.create({
          data: {
            employee: {
              connect: {
                id: employeeId,
              },
            },

            department: {
              connect: {
                id: bulkAttendanceDto.departmentId,
              },
            },
            designation: {
              connect: {
                id: bulkAttendanceDto.designationId,
              },
            },

            attendanceDate,

            status: bulkAttendanceDto.status,

            shift: bulkAttendanceDto.shift,

            remarks: bulkAttendanceDto.remarks,
          },

          select: this.attendanceDetailSelect,
        }),
      ),
    );
  }

  // =========================================================
  // MONTHLY ATTENDANCE SUMMARY
  // =========================================================

  async getMonthlyAttendanceSummary(query: MonthlyAttendanceQueryDto) {
    const { employeeId, month, year } = query;

    const startDate = new Date(year, month - 1, 1);

    const endDate = new Date(year, month, 1);

    // =======================================================
    // DAILY ATTENDANCE + DAILY OT ATTENDANCE
    //
    // Attendance provides attendance status.
    // OtAttendance provides manually entered OT hours.
    //
    // OT is no longer read from legacy Attendance.otHours.
    // =======================================================

    const [attendances, otAttendances] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          employeeId,

          attendanceDate: {
            gte: startDate,
            lt: endDate,
          },
        },

        select: {
          status: true,

          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),

      this.prisma.otAttendance.findMany({
        where: {
          employeeId,

          attendanceDate: {
            gte: startDate,
            lt: endDate,
          },
        },

        select: {
          otHours: true,
        },
      }),
    ]);

    // Preserve the existing Monthly Attendance Summary behavior:
    // the summary exists only when Daily Attendance exists.
    if (attendances.length === 0) {
      return null;
    }

    let present = 0;
    let absent = 0;
    let leave = 0;
    let holiday = 0;
    let weeklyOff = 0;
    let halfDay = 0;
    let paidHoliday = 0;

    // =======================================================
    // ATTENDANCE STATUS TOTALS
    // =======================================================

    attendances.forEach((attendance) => {
      switch (attendance.status) {
        case 'PRESENT':
          present++;
          break;

        case 'ABSENT':
          absent++;
          break;

        case 'LEAVE':
          leave++;
          break;

        case 'HOLIDAY':
          holiday++;
          break;

        case 'WEEKLY_OFF':
          weeklyOff++;
          break;

        case 'HALF_DAY':
          halfDay++;
          break;

        case 'PAID_HOLIDAY':
          paidHoliday++;
          break;
      }
    });

    // =======================================================
    // MANUAL OT TOTAL
    //
    // Every legitimate Daily OT Attendance row is counted.
    // Therefore multiple shifts for the same employee/date
    // are correctly summed.
    // =======================================================

    const otHours = otAttendances.reduce((total, otAttendance) => {
      return total + Number(otAttendance.otHours);
    }, 0);

    const employee = attendances[0].employee;

    return {
      employeeId: employee.id,

      employeeName: `${employee.firstName} ${employee.lastName}`,

      year,

      month,

      present,

      absent,

      leave,

      holiday,

      weeklyOff,

      halfDay,

      paidHoliday,

      otHours,
    };
  }
  // =========================================================
  // ATTENDANCE REPORT ORGANISATION CONTEXT
  //
  // Used by report Service validation and dynamic headers.
  //
  // Department
  //   -> Work Type
  //      -> Site
  // =========================================================

  async findAttendanceReportDepartmentContext(departmentId: number) {
    return this.prisma.department.findUnique({
      where: {
        id: departmentId,
      },

      select: {
        id: true,
        departmentName: true,
        workTypeId: true,

        workType: {
          select: {
            id: true,
            workTypeName: true,
            siteId: true,

            site: {
              select: {
                id: true,
                siteName: true,
              },
            },
          },
        },
      },
    });
  }

  // =========================================================
  // MONTHLY ATTENDANCE REPORT DATA
  //
  // No pagination.
  //
  // This is the common raw dataset that will later be reused
  // by Muster, OT Muster and Muster With OT.
  //
  // Attendance organisation context:
  //
  // Attendance -> Department -> Work Type -> Site
  //
  // Employee:
  //
  // Employee -> Designation
  // =========================================================

  async findMonthlyAttendanceReportData(query: AttendanceReportQueryDto) {
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));

    const endDate = new Date(Date.UTC(query.year, query.month, 1));

    const where: Prisma.AttendanceWhereInput = {
      attendanceDate: {
        gte: startDate,
        lt: endDate,
      },

      departmentId: query.departmentId,

      department: {
        workTypeId: query.workTypeId,

        workType: {
          siteId: query.siteId,
        },
      },
    };

    if (query.shift) {
      where.shift = query.shift;
    }

    return this.prisma.attendance.findMany({
      where,

      orderBy: [
        {
          employee: {
            firstName: 'asc',
          },
        },
        {
          employee: {
            lastName: 'asc',
          },
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],

      select: {
        id: true,
        attendanceDate: true,
        status: true,
        shift: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            joiningDate: true,

            designation: {
              select: {
                id: true,
                designationName: true,
              },
            },
          },
        },

        department: {
          select: {
            id: true,
            departmentName: true,

            workType: {
              select: {
                id: true,
                workTypeName: true,

                site: {
                  select: {
                    id: true,
                    siteName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  async findMonthlyOtAttendanceReportData(query: AttendanceReportQueryDto) {
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));

    const endDate = new Date(Date.UTC(query.year, query.month, 1));

    const where: Prisma.OtAttendanceWhereInput = {
      attendanceDate: {
        gte: startDate,
        lt: endDate,
      },

      departmentId: query.departmentId,

      department: {
        workTypeId: query.workTypeId,

        workType: {
          siteId: query.siteId,
        },
      },
    };

    if (query.shift) {
      where.shift = query.shift;
    }

    return this.prisma.otAttendance.findMany({
      where,

      orderBy: [
        {
          employee: {
            firstName: 'asc',
          },
        },
        {
          employee: {
            lastName: 'asc',
          },
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
      ],

      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        shift: true,
        otHours: true,

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },

        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            joiningDate: true,

            designation: {
              select: {
                id: true,
                designationName: true,
              },
            },
          },
        },

        department: {
          select: {
            id: true,
            departmentName: true,

            workType: {
              select: {
                id: true,
                workTypeName: true,

                site: {
                  select: {
                    id: true,
                    siteName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
  // =========================================================
  // FORM XXIII - SITE CONTEXT
  // =========================================================

  async findFormXxiiiSite(siteId: number) {
    return this.prisma.site.findUnique({
      where: {
        id: siteId,
      },

      select: {
        id: true,
        siteName: true,
      },
    });
  }

  // =========================================================
  // FORM XXIII - SITE OT ATTENDANCE
  //
  // Attendance determines which OT belongs to the selected
  // operational Site.
  //
  // Monetary rates are NOT taken from Attendance.
  // They come from the finalized Payroll snapshot.
  // =========================================================

  async findFormXxiiiSiteOtAttendance(query: FormXxiiiReportQueryDto) {
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));

    const endDate = new Date(Date.UTC(query.year, query.month, 1));

    return this.prisma.otAttendance.findMany({
      where: {
        attendanceDate: {
          gte: startDate,
          lt: endDate,
        },

        department: {
          workType: {
            siteId: query.siteId,
          },
        },
      },

      orderBy: [
        {
          employeeId: 'asc',
        },
        {
          attendanceDate: 'asc',
        },
      ],

      select: {
        employeeId: true,
        attendanceDate: true,
        otHours: true,
      },
    });
  }

  // =========================================================
  // FORM XXIII - FINALIZED PAYROLL SNAPSHOTS
  //
  // Historical wage / OT monetary values must come from the
  // FINALIZED payroll snapshot for the selected salary month.
  // =========================================================

  async findFormXxiiiFinalizedPayroll(
    salaryMonth: Date,
    employeeIds: number[],
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: 'FINALIZED',
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        salaryMonth: true,
        version: true,
        finalizedAt: true,

        snapshots: {
          where:
            employeeIds.length > 0
              ? {
                  employeeId: {
                    in: employeeIds,
                  },
                }
              : {
                  employeeId: {
                    in: [],
                  },
                },

          orderBy: {
            employeeId: 'asc',
          },

          select: {
            employeeId: true,
            employeeName: true,
            gender: true,
            designationId: true,
            designationName: true,

            bankName: true,

            monthlyBasic: true,
            monthlyDa: true,

            otRate: true,
          },
        },
      },
    });
  }
  // =========================================================
  // MUSTER CUT FILE - WORK TYPE CONTEXT
  //
  // Used to validate:
  //
  // Site
  //   -> Work Type
  //
  // Department remains optional because the approved Cut File
  // may contain multiple Departments in the report body.
  // =========================================================

  async findMusterCutFileWorkTypeContext(workTypeId: number) {
    return this.prisma.workType.findUnique({
      where: {
        id: workTypeId,
      },

      select: {
        id: true,
        workTypeName: true,
        siteId: true,

        site: {
          select: {
            id: true,
            siteName: true,
          },
        },
      },
    });
  }

  // =========================================================
  // MUSTER CUT FILE - DEPARTMENT CONTEXT
  // =========================================================

  async findMusterCutFileDepartmentContext(departmentId: number) {
    return this.prisma.department.findUnique({
      where: {
        id: departmentId,
      },

      select: {
        id: true,
        departmentName: true,
        workTypeId: true,
      },
    });
  }

  // =========================================================
  // MUSTER CUT FILE - MONTHLY RAW DATA
  //
  // Returns only the fields required to aggregate:
  //
  // Department
  // Designation
  // Shift
  // Attendance Date
  // Attendance Status
  //
  // No pagination.
  // =========================================================

  async findMusterCutFileData(query: MusterCutFileQueryDto) {
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));

    const endDate = new Date(Date.UTC(query.year, query.month, 1));

    const where: Prisma.AttendanceWhereInput = {
      attendanceDate: {
        gte: startDate,
        lt: endDate,
      },

      department: {
        workTypeId: query.workTypeId,

        workType: {
          siteId: query.siteId,
        },
      },
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.designationId) {
      where.designationId = query.designationId;
    }

    return this.prisma.attendance.findMany({
      where,

      orderBy: [
        {
          department: {
            departmentName: 'asc',
          },
        },
        {
          employee: {
            designation: {
              designationName: 'asc',
            },
          },
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
        {
          employeeId: 'asc',
        },
      ],

      select: {
        employeeId: true,
        attendanceDate: true,
        status: true,
        shift: true,

        // Operational designation selected while punching Attendance
        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },

        department: {
          select: {
            id: true,
            departmentName: true,
          },
        },

        // Keep Employee master designation temporarily because
        // existing service code still references it.
        // We will remove this dependency in the next service change.
        employee: {
          select: {
            designation: {
              select: {
                id: true,
                designationName: true,
              },
            },
          },
        },
      },
    });
  }
  async findOtMusterCutFileData(query: MusterCutFileQueryDto) {
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));

    const endDate = new Date(Date.UTC(query.year, query.month, 1));

    const where: Prisma.OtAttendanceWhereInput = {
      attendanceDate: {
        gte: startDate,
        lt: endDate,
      },

      department: {
        workTypeId: query.workTypeId,

        workType: {
          siteId: query.siteId,
        },
      },
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.designationId) {
      where.designationId = query.designationId;
    }

    return this.prisma.otAttendance.findMany({
      where,

      orderBy: [
        {
          department: {
            departmentName: 'asc',
          },
        },
        {
          designation: {
            designationName: 'asc',
          },
        },
        {
          attendanceDate: 'asc',
        },
        {
          shift: 'asc',
        },
        {
          employeeId: 'asc',
        },
      ],

      select: {
        employeeId: true,
        attendanceDate: true,
        shift: true,
        otHours: true,

        department: {
          select: {
            id: true,
            departmentName: true,
          },
        },

        designation: {
          select: {
            id: true,
            designationName: true,
          },
        },
      },
    });
  }

  // =========================================================
  // FIND BY ID
  // =========================================================

  async findAttendanceById(id: number) {
    return this.prisma.attendance.findUnique({
      where: {
        id,
      },

      select: this.attendanceDetailSelect,
    });
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async updateAttendance(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    const data: Prisma.AttendanceUpdateInput = {};

    if (updateAttendanceDto.employeeId !== undefined) {
      data.employee = {
        connect: {
          id: updateAttendanceDto.employeeId,
        },
      };
    }
    if (updateAttendanceDto.departmentId !== undefined) {
      data.department = {
        connect: {
          id: updateAttendanceDto.departmentId,
        },
      };
    }

    if (updateAttendanceDto.designationId !== undefined) {
      data.designation = {
        connect: {
          id: updateAttendanceDto.designationId,
        },
      };
    }

    if (updateAttendanceDto.attendanceDate) {
      data.attendanceDate = new Date(updateAttendanceDto.attendanceDate);
    }

    if (updateAttendanceDto.status !== undefined) {
      data.status = updateAttendanceDto.status;
    }

    if (updateAttendanceDto.shift !== undefined) {
      data.shift = updateAttendanceDto.shift;
    }

    if (updateAttendanceDto.remarks !== undefined) {
      data.remarks = updateAttendanceDto.remarks;
    }

    return this.prisma.attendance.update({
      where: {
        id,
      },

      data,

      select: this.attendanceDetailSelect,
    });
  }

  // =========================================================
  // DELETE
  // =========================================================

  async deleteAttendance(id: number) {
    return this.prisma.attendance.delete({
      where: {
        id,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { BulkOtUpdateDto } from '../dto/bulk-ot-update.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';
import { AttendanceShift, Prisma } from '@prisma/client';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // ATTENDANCE LIST SELECT
  //
  // Locked organisation architecture:
  //
  // Site
  // ├── Work Type
  // │   └── Department
  // │
  // └── Designation
  //     └── Employee
  //
  // Attendance now stores Department so the operational
  // Department / Work Type / Site context survives refresh.
  //
  // Employee continues to belong to Designation.
  // Designation continues to belong directly to Site.
  // =========================================================

  private readonly attendanceListSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    shift: true,
    otHours: true,
    remarks: true,

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
  };

  // =========================================================
  // ATTENDANCE DETAIL SELECT
  // =========================================================

  private readonly attendanceDetailSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    shift: true,
    otHours: true,
    remarks: true,
    createdAt: true,
    updatedAt: true,

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

        designation: {
          select: {
            siteId: true,
          },
        },
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

        designation: {
          select: {
            siteId: true,
          },
        },
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

        attendanceDate: new Date(createAttendanceDto.attendanceDate),

        status: createAttendanceDto.status,

        shift: createAttendanceDto.shift,

        otHours: createAttendanceDto.otHours,

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
    // EMPLOYEE FILTERS
    //
    // Employee -> Designation -> Site
    // =======================================================

    if (designationId || search) {
      const employeeWhere: Prisma.EmployeeWhereInput = {};

      if (designationId) {
        employeeWhere.designationId = designationId;
      }

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

            attendanceDate,

            status: bulkAttendanceDto.status,

            shift: bulkAttendanceDto.shift,

            otHours: bulkAttendanceDto.otHours,

            remarks: bulkAttendanceDto.remarks,
          },

          select: this.attendanceDetailSelect,
        }),
      ),
    );
  }

  // =========================================================
  // BULK OT UPDATE
  // =========================================================

  async bulkUpdateOt(bulkOtUpdateDto: BulkOtUpdateDto) {
    const attendanceDate = new Date(bulkOtUpdateDto.attendanceDate);

    return this.prisma.$transaction(
      bulkOtUpdateDto.employees.map((employee) =>
        this.prisma.attendance.updateMany({
          where: {
            employeeId: employee.employeeId,

            attendanceDate,

            shift: employee.shift,
          },

          data: {
            otHours: employee.otHours,
          },
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

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId,

        attendanceDate: {
          gte: startDate,
          lt: endDate,
        },
      },

      select: {
        status: true,
        otHours: true,

        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

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
    let otHours = 0;

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

      otHours += Number(attendance.otHours);
    });

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

    if (updateAttendanceDto.attendanceDate) {
      data.attendanceDate = new Date(updateAttendanceDto.attendanceDate);
    }

    if (updateAttendanceDto.status !== undefined) {
      data.status = updateAttendanceDto.status;
    }

    if (updateAttendanceDto.shift !== undefined) {
      data.shift = updateAttendanceDto.shift;
    }

    if (updateAttendanceDto.otHours !== undefined) {
      data.otHours = updateAttendanceDto.otHours;
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

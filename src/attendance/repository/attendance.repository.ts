import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { BulkOtUpdateDto } from '../dto/bulk-ot-update.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly attendanceListSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    otHours: true,
    remarks: true,

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
        },
      },
    },
  };

  private readonly attendanceDetailSelect = {
    id: true,
    attendanceDate: true,
    status: true,
    otHours: true,
    remarks: true,
    createdAt: true,
    updatedAt: true,

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
        },
      },
    },
  };

  async create(createAttendanceDto: CreateAttendanceDto) {
    return this.prisma.attendance.create({
      data: {
        employee: {
          connect: {
            id: createAttendanceDto.employeeId,
          },
        },

        attendanceDate: new Date(createAttendanceDto.attendanceDate),

        status: createAttendanceDto.status,

        otHours: createAttendanceDto.otHours,

        remarks: createAttendanceDto.remarks,
      },

      select: this.attendanceDetailSelect,
    });
  }

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
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {};

    /*
     * Attendance Date
     */
    if (attendanceDate) {
      const date = new Date(attendanceDate);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      where.attendanceDate = {
        gte: date,
        lt: nextDate,
      };
    }

    /*
     * Attendance Status
     */
    if (status) {
      where.status = status;
    }

    /*
     * Employee organisation hierarchy:
     *
     * Employee
     *   └── Designation
     *         └── Department
     *               └── Work Type
     *                     └── Site
     *
     * Therefore:
     *
     * designationId
     * departmentId
     * workTypeId
     * siteId
     *
     * are all filtered through Employee -> Designation.
     */

    if (designationId || departmentId || workTypeId || siteId || search) {
      const employeeWhere: Prisma.EmployeeWhereInput = {};

      /*
       * Organisation filters
       */
      if (designationId || departmentId || workTypeId || siteId) {
        const designationWhere: Prisma.DesignationWhereInput = {};

        if (designationId) {
          designationWhere.id = designationId;
        }

        if (departmentId || workTypeId || siteId) {
          const departmentWhere: Prisma.DepartmentWhereInput = {};

          if (departmentId) {
            departmentWhere.id = departmentId;
          }

          if (workTypeId || siteId) {
            const workTypeWhere: Prisma.WorkTypeWhereInput = {};

            if (workTypeId) {
              workTypeWhere.id = workTypeId;
            }

            if (siteId) {
              workTypeWhere.siteId = siteId;
            }

            departmentWhere.workType = workTypeWhere;
          }
        }

        employeeWhere.designation = designationWhere;
      }

      /*
       * Employee search
       */
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
      pending,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'PRESENT',
        },
      }),

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'ABSENT',
        },
      }),

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'LEAVE',
        },
      }),

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'HOLIDAY',
        },
      }),

      this.prisma.attendance.count({
        where: {
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },

          status: 'WEEKLY_OFF',
        },
      }),

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
      pending,
    };
  }

  async findExistingAttendance(attendanceDate: Date, employeeIds: number[]) {
    return this.prisma.attendance.findMany({
      where: {
        attendanceDate,

        employeeId: {
          in: employeeIds,
        },
      },

      select: {
        employeeId: true,

        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

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

            attendanceDate,

            status: bulkAttendanceDto.status,

            otHours: bulkAttendanceDto.otHours,

            remarks: bulkAttendanceDto.remarks,
          },

          select: this.attendanceDetailSelect,
        }),
      ),
    );
  }

  async bulkUpdateOt(bulkOtUpdateDto: BulkOtUpdateDto) {
    const attendanceDate = new Date(bulkOtUpdateDto.attendanceDate);

    return this.prisma.$transaction(
      bulkOtUpdateDto.employees.map((employee) =>
        this.prisma.attendance.updateMany({
          where: {
            employeeId: employee.employeeId,

            attendanceDate,
          },

          data: {
            otHours: employee.otHours,
          },
        }),
      ),
    );
  }

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

      otHours,
    };
  }

  async findAttendanceById(id: number) {
    return this.prisma.attendance.findUnique({
      where: {
        id,
      },

      select: this.attendanceDetailSelect,
    });
  }

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

  async deleteAttendance(id: number) {
    return this.prisma.attendance.delete({
      where: {
        id,
      },
    });
  }
}

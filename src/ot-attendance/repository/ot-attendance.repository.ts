import { Injectable } from '@nestjs/common';
import { AttendanceShift, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOtAttendanceDto } from '../dto/create-ot-attendance.dto';
import { BulkOtAttendanceDto } from '../dto/bulk-ot-attendance.dto';
import { UpdateOtAttendanceDto } from '../dto/update-ot-attendance.dto';
import { OtAttendanceQueryDto } from '../dto/ot-attendance-query.dto';

@Injectable()
export class OtAttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly otAttendanceSelect = {
    id: true,
    attendanceDate: true,
    shift: true,
    otHours: true,
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

  async findEmployeeContext(employeeId: number) {
    return this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
      },
    });
  }

  async findEmployeesContext(employeeIds: number[]) {
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

  async findDepartmentContext(departmentId: number) {
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

  async findDesignationContext(designationId: number) {
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

  async findFinalizedPayrollRunForSiteAndMonth(
    siteId: number | null,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        salaryMonth,
        status: 'FINALIZED',

        ...(siteId === null
          ? {}
          : {
              OR: [
                {
                  siteId,
                },
                {
                  siteId: null,
                },
              ],
            }),
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        siteId: true,
        version: true,
        salaryMonth: true,
        status: true,
      },
    });
  }

  async findExisting(
    attendanceDate: Date,
    employeeIds: number[],
    shift: AttendanceShift,
  ) {
    return this.prisma.otAttendance.findMany({
      where: {
        attendanceDate,
        shift,

        employeeId: {
          in: employeeIds,
        },
      },

      select: {
        id: true,
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

  async create(dto: CreateOtAttendanceDto) {
    return this.prisma.otAttendance.create({
      data: {
        employee: {
          connect: {
            id: dto.employeeId,
          },
        },

        department: {
          connect: {
            id: dto.departmentId,
          },
        },

        designation: {
          connect: {
            id: dto.designationId,
          },
        },

        attendanceDate: new Date(dto.attendanceDate),
        shift: dto.shift,
        otHours: dto.otHours,
        remarks: dto.remarks,
      },

      select: this.otAttendanceSelect,
    });
  }

  async bulkCreate(dto: BulkOtAttendanceDto) {
    const attendanceDate = new Date(dto.attendanceDate);

    return this.prisma.$transaction(
      dto.employeeIds.map((employeeId) =>
        this.prisma.otAttendance.create({
          data: {
            employee: {
              connect: {
                id: employeeId,
              },
            },

            department: {
              connect: {
                id: dto.departmentId,
              },
            },

            designation: {
              connect: {
                id: dto.designationId,
              },
            },

            attendanceDate,
            shift: dto.shift,
            otHours: dto.otHours,
            remarks: dto.remarks,
          },

          select: this.otAttendanceSelect,
        }),
      ),
    );
  }

  async findAll(query: OtAttendanceQueryDto) {
    const {
      page,
      limit,
      attendanceDate,
      siteId,
      workTypeId,
      departmentId,
      designationId,
      shift,
      search,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.OtAttendanceWhereInput = {};

    if (attendanceDate) {
      const date = new Date(attendanceDate);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      where.attendanceDate = {
        gte: date,
        lt: nextDate,
      };
    }

    if (shift) {
      where.shift = shift;
    }

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

    /*
     * designationId is the operational OT designation,
     * not Employee.designationId.
     */
    if (designationId) {
      where.designationId = designationId;
    }

    if (search) {
      where.employee = {
        OR: [
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
        ],
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.otAttendance.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            attendanceDate: 'desc',
          },
          {
            employeeId: 'asc',
          },
          {
            shift: 'asc',
          },
        ],

        select: this.otAttendanceSelect,
      }),

      this.prisma.otAttendance.count({
        where,
      }),
    ]);

    return {
      records,
      total,
    };
  }

  async findById(id: number) {
    return this.prisma.otAttendance.findUnique({
      where: {
        id,
      },

      select: this.otAttendanceSelect,
    });
  }

  async update(id: number, dto: UpdateOtAttendanceDto) {
    const data: Prisma.OtAttendanceUpdateInput = {};

    if (dto.employeeId !== undefined) {
      data.employee = {
        connect: {
          id: dto.employeeId,
        },
      };
    }

    if (dto.departmentId !== undefined) {
      data.department = {
        connect: {
          id: dto.departmentId,
        },
      };
    }

    if (dto.designationId !== undefined) {
      data.designation = {
        connect: {
          id: dto.designationId,
        },
      };
    }

    if (dto.attendanceDate !== undefined) {
      data.attendanceDate = new Date(dto.attendanceDate);
    }

    if (dto.shift !== undefined) {
      data.shift = dto.shift;
    }

    if (dto.otHours !== undefined) {
      data.otHours = dto.otHours;
    }

    if (dto.remarks !== undefined) {
      data.remarks = dto.remarks;
    }

    return this.prisma.otAttendance.update({
      where: {
        id,
      },

      data,

      select: this.otAttendanceSelect,
    });
  }

  async delete(id: number) {
    return this.prisma.otAttendance.delete({
      where: {
        id,
      },
    });
  }
}

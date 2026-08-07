import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from '../dto/update-employee-status.dto';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        firstName: createEmployeeDto.firstName,
        lastName: createEmployeeDto.lastName,
        email: createEmployeeDto.email,
        phone: createEmployeeDto.phone,
        joiningDate: new Date(createEmployeeDto.joiningDate),
        basicSalary: createEmployeeDto.basicSalary,

        designation: {
          connect: {
            id: createEmployeeDto.designationId,
          },
        },
      },
    });
  }

  async findEmployees(query: EmployeeQueryDto) {
    const { page, limit, search, designation, status, sortBy, order } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    if (designation) {
      where.designation = {
        designationName: designation,
      };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
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
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          joiningDate: true,
          status: true,

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

  async findEmployeeById(id: number) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        joiningDate: true,
        basicSalary: true,
        status: true,
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
    });
  }

  async updateEmployee(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const { designationId, joiningDate, ...rest } = updateEmployeeDto;

    const data: Prisma.EmployeeUpdateInput = {
      ...rest,
    };

    if (joiningDate) {
      data.joiningDate = new Date(joiningDate);
    }

    if (designationId) {
      data.designation = {
        connect: {
          id: designationId,
        },
      };
    }

    return this.prisma.employee.update({
      where: {
        id,
      },
      data,
    });
  }
  async updateEmployeeStatus(
    id: number,
    updateEmployeeStatusDto: UpdateEmployeeStatusDto,
  ) {
    return this.prisma.employee.update({
      where: {
        id,
      },
      data: {
        status: updateEmployeeStatusDto.status,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }
}

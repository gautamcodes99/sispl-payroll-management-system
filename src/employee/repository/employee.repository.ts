import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        joiningDate: new Date(createEmployeeDto.joiningDate),
      },
    });
  }

  async findEmployees(query: EmployeeQueryDto) {
    const {
      page,
      limit,
      search,
      department,
      designation,
      status,
      sortBy,
      order,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    if (department) {
      where.department = department;
    }

    if (designation) {
      where.designation = designation;
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
          department: true,
          designation: true,
          joiningDate: true,
          status: true,
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
        department: true,
        designation: true,
        joiningDate: true,
        basicSalary: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async updateEmployee(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const data: Prisma.EmployeeUpdateInput = {
      ...updateEmployeeDto,
    };

    if (updateEmployeeDto.joiningDate) {
      data.joiningDate = new Date(updateEmployeeDto.joiningDate);
    }

    return this.prisma.employee.update({
      where: {
        id,
      },
      data,
    });
  }
}

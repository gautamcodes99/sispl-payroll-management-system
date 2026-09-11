import { Injectable } from '@nestjs/common';
import {
  HolidayCalendar,
  HolidayCalendarType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HolidayCalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.HolidayCalendarCreateInput,
  ): Promise<HolidayCalendar> {
    return this.prisma.holidayCalendar.create({
      data,
    });
  }

  async findById(id: number): Promise<HolidayCalendar | null> {
    return this.prisma.holidayCalendar.findUnique({
      where: {
        id,
      },
    });
  }

  async findByDate(date: Date): Promise<HolidayCalendar | null> {
    return this.prisma.holidayCalendar.findUnique({
      where: {
        date,
      },
    });
  }

  async findAll(
    fromDate?: Date,
    toDate?: Date,
    type?: HolidayCalendarType,
  ): Promise<HolidayCalendar[]> {
    return this.prisma.holidayCalendar.findMany({
      where: {
        ...(fromDate !== undefined || toDate !== undefined
          ? {
              date: {
                ...(fromDate !== undefined && {
                  gte: fromDate,
                }),
                ...(toDate !== undefined && {
                  lte: toDate,
                }),
              },
            }
          : {}),
        ...(type !== undefined && {
          type,
        }),
      },

      orderBy: {
        date: 'asc',
      },
    });
  }

  async update(
    id: number,
    data: Prisma.HolidayCalendarUpdateInput,
  ): Promise<HolidayCalendar> {
    return this.prisma.holidayCalendar.update({
      where: {
        id,
      },
      data,
    });
  }

  async delete(id: number): Promise<HolidayCalendar> {
    return this.prisma.holidayCalendar.delete({
      where: {
        id,
      },
    });
  }
}

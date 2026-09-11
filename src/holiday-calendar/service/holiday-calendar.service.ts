import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateHolidayCalendarDto } from '../dto/create-holiday-calendar.dto';
import { HolidayCalendarQueryDto } from '../dto/holiday-calendar-query.dto';
import { UpdateHolidayCalendarDto } from '../dto/update-holiday-calendar.dto';
import { HolidayCalendarRepository } from '../repository/holiday-calendar.repository';

@Injectable()
export class HolidayCalendarService {
  constructor(
    private readonly holidayCalendarRepository: HolidayCalendarRepository,
  ) {}

  private normalizeDate(value: string): Date {
    const parsed = new Date(value);

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private normalizeName(name?: string): string | null {
    if (name === undefined) {
      return null;
    }

    const trimmed = name.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private getMonthRange(month: string): {
    fromDate: Date;
    toDate: Date;
  } {
    const date = this.normalizeDate(month);

    const fromDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );

    const toDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    );

    return {
      fromDate,
      toDate,
    };
  }

  async create(dto: CreateHolidayCalendarDto) {
    const date = this.normalizeDate(dto.date);

    const existing = await this.holidayCalendarRepository.findByDate(date);

    if (existing) {
      throw new ConflictException(
        'Holiday Calendar entry already exists for this date.',
      );
    }

    const holidayCalendar = await this.holidayCalendarRepository.create({
      date,
      type: dto.type,
      name: this.normalizeName(dto.name),
    });

    return {
      success: true,
      message: 'Holiday Calendar entry created successfully.',
      data: holidayCalendar,
    };
  }

  async findAll(query: HolidayCalendarQueryDto) {
    if (query.month && (query.fromDate || query.toDate)) {
      throw new BadRequestException(
        'Use either month or fromDate/toDate filters, not both.',
      );
    }

    if (
      (query.fromDate && !query.toDate) ||
      (!query.fromDate && query.toDate)
    ) {
      throw new BadRequestException(
        'Both fromDate and toDate are required when using a date range.',
      );
    }

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (query.month) {
      const range = this.getMonthRange(query.month);

      fromDate = range.fromDate;
      toDate = range.toDate;
    } else if (query.fromDate && query.toDate) {
      fromDate = this.normalizeDate(query.fromDate);
      toDate = this.normalizeDate(query.toDate);

      if (fromDate.getTime() > toDate.getTime()) {
        throw new BadRequestException(
          'From Date cannot be later than To Date.',
        );
      }
    }

    const holidayCalendars = await this.holidayCalendarRepository.findAll(
      fromDate,
      toDate,
      query.type,
    );

    return {
      success: true,
      message: 'Holiday Calendar entries fetched successfully.',
      data: holidayCalendars,
    };
  }

  async findOne(id: number) {
    const holidayCalendar =
      await this.holidayCalendarRepository.findById(id);

    if (!holidayCalendar) {
      throw new NotFoundException('Holiday Calendar entry not found.');
    }

    return {
      success: true,
      message: 'Holiday Calendar entry fetched successfully.',
      data: holidayCalendar,
    };
  }

  async update(id: number, dto: UpdateHolidayCalendarDto) {
    const currentResponse = await this.findOne(id);
    const current = currentResponse.data;

    let date = current.date;

    if (dto.date !== undefined) {
      date = this.normalizeDate(dto.date);

      const existing = await this.holidayCalendarRepository.findByDate(date);

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Holiday Calendar entry already exists for this date.',
        );
      }
    }

    const holidayCalendar = await this.holidayCalendarRepository.update(id, {
      ...(dto.date !== undefined && {
        date,
      }),
      ...(dto.type !== undefined && {
        type: dto.type,
      }),
      ...(dto.name !== undefined && {
        name: this.normalizeName(dto.name),
      }),
    });

    return {
      success: true,
      message: 'Holiday Calendar entry updated successfully.',
      data: holidayCalendar,
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    const holidayCalendar = await this.holidayCalendarRepository.delete(id);

    return {
      success: true,
      message: 'Holiday Calendar entry deleted successfully.',
      data: holidayCalendar,
    };
  }
}

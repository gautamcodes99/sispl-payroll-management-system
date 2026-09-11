import { HolidayCalendarType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class HolidayCalendarQueryDto {
  @IsOptional()
  @IsDateString()
  month?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(HolidayCalendarType)
  type?: HolidayCalendarType;
}

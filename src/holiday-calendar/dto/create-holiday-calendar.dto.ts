import { HolidayCalendarType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateHolidayCalendarDto {
  @IsDateString()
  date: string;

  @IsEnum(HolidayCalendarType)
  type: HolidayCalendarType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;
}

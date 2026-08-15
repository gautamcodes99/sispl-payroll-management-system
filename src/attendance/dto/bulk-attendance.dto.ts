import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceShift, AttendanceStatus } from '@prisma/client';

export class BulkAttendanceDto {
  @IsDateString()
  attendanceDate!: Date;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @Type(() => Number)
  @IsNumber()
  otHours!: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  employeeIds!: number[];
}

import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceShift, AttendanceStatus } from '@prisma/client';

export class BulkAttendanceDto {
  @IsDateString()
  attendanceDate!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
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

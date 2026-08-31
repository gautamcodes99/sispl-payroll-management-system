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
import { AttendanceShift } from '@prisma/client';

export class BulkOtAttendanceDto {
  @IsDateString()
  attendanceDate!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId!: number;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  otHours!: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds!: number[];
}

import {
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

export class CreateOtAttendanceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId!: number;

  @IsDateString()
  attendanceDate!: Date;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  otHours!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

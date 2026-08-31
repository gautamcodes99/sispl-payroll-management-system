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

export class UpdateOtAttendanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId?: number;

  @IsOptional()
  @IsDateString()
  attendanceDate?: Date;

  @IsOptional()
  @IsEnum(AttendanceShift)
  shift?: AttendanceShift;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  otHours?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

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
import { AttendanceShift, AttendanceStatus } from '@prisma/client';

export class UpdateAttendanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsDateString()
  attendanceDate?: Date;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsEnum(AttendanceShift)
  shift?: AttendanceShift;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otHours?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

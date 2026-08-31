import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceShift, AttendanceStatus } from '@prisma/client';

export class CreateAttendanceDto {
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

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @IsOptional()
  @IsString()
  remarks?: string;
}

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

export class CreateAttendanceDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @IsDateString()
  attendanceDate!: Date;

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
}

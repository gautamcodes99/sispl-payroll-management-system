import { AttendanceShift } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';

export class MultiShiftWarningQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @IsDateString()
  attendanceDate: string;

  @IsEnum(AttendanceShift)
  shift: AttendanceShift;
}

import { Type } from 'class-transformer';
import { AttendanceShift } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AttendanceReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  workTypeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @IsOptional()
  @IsEnum(AttendanceShift)
  shift?: AttendanceShift;
}

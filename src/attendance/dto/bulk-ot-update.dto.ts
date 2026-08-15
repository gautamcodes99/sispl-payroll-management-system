import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceShift } from '@prisma/client';

class EmployeeOtDto {
  @Type(() => Number)
  @IsNumber()
  employeeId!: number;

  @IsEnum(AttendanceShift)
  shift!: AttendanceShift;

  @Type(() => Number)
  @IsNumber()
  otHours!: number;
}

export class BulkOtUpdateDto {
  @IsDateString()
  attendanceDate!: Date;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EmployeeOtDto)
  employees!: EmployeeOtDto[];
}

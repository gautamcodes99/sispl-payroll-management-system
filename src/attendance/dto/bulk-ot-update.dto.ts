import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EmployeeOtDto {
  @Type(() => Number)
  @IsNumber()
  employeeId!: number;

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

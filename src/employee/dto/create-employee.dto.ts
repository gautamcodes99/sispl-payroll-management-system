import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEmployeeDto {
  // Personal Information

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Employment

  @IsDateString()
  joiningDate!: string;

  @Type(() => Number)
  @IsNumber()
  designationId!: number;

  @Type(() => Number)
  @IsNumber()
  basicSalary!: number;
}

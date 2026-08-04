import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @IsString()
  employeeCode!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  department!: string;

  @IsString()
  designation!: string;

  @IsDateString()
  joiningDate!: string;

  @Type(() => Number)
  @IsNumber()
  basicSalary!: number;
}

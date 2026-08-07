import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateEmployeeDto {
  // Personal Information

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  phone!: string;

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

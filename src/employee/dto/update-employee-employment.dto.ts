import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class UpdateEmployeeEmploymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId!: number;

  @IsDateString()
  joiningDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicSalary!: number;
}

import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class VariableAllowanceQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsDateString()
  salaryMonth?: string;
}
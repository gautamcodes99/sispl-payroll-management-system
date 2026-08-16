import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateVariableAllowanceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @IsDateString()
  salaryMonth: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conveyance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rab?: number;
}

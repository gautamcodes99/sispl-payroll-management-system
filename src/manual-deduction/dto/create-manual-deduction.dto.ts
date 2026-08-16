import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateManualDeductionDto {
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
  advanceRecovery?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  canteen?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transport?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  uniformRecovery?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fine?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherDeduction?: number;
}

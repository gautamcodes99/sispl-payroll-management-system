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
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsDateString()
  salaryMonth!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newAdvance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfInstallments?: number;

  // Business/UI label: Actual Advance Deduction.
  // Field name retained for existing payroll compatibility.
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
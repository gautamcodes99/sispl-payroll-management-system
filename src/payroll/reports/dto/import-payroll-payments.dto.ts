import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  PayrollPaymentMode,
  PayrollPaymentStatus,
} from '@prisma/client';

export class ImportPayrollPaymentRowDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsEnum(PayrollPaymentStatus)
  status!: PayrollPaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PayrollPaymentMode)
  paymentMode?: PayrollPaymentMode;
}

export class ImportPayrollPaymentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @IsDateString()
  salaryMonth!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportPayrollPaymentRowDto)
  payments!: ImportPayrollPaymentRowDto[];
}
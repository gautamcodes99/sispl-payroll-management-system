import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollPaymentMode, PayrollPaymentStatus } from '@prisma/client';

export class BulkUpdatePayrollPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  snapshotIds!: number[];

  @IsEnum(PayrollPaymentStatus)
  status!: PayrollPaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PayrollPaymentMode)
  paymentMode?: PayrollPaymentMode;
}

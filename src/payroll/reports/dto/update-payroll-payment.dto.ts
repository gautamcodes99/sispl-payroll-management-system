import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PayrollPaymentMode, PayrollPaymentStatus } from '@prisma/client';

export class UpdatePayrollPaymentDto {
  @IsEnum(PayrollPaymentStatus)
  status!: PayrollPaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PayrollPaymentMode)
  paymentMode?: PayrollPaymentMode;
}

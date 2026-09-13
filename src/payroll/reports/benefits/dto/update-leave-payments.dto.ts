import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { LeavePaymentMode, LeavePaymentStatus } from '@prisma/client';

export class UpdateLeavePaymentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  year!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds!: number[];

  @IsEnum(LeavePaymentStatus)
  status!: LeavePaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(LeavePaymentMode)
  paymentMode?: LeavePaymentMode;
}

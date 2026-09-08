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
import { BonusPaymentMode, BonusPaymentStatus } from '@prisma/client';

export class UpdateBonusPaymentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  financialYear!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds!: number[];

  @IsEnum(BonusPaymentStatus)
  status!: BonusPaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(BonusPaymentMode)
  paymentMode?: BonusPaymentMode;
}
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class PayrollRunQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @IsOptional()
  @IsDateString()
  salaryMonth?: string;
}
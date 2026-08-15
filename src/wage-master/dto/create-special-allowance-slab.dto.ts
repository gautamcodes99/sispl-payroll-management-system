import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CreateSpecialAllowanceSlabDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDays: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDays: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePerDay: number;
}

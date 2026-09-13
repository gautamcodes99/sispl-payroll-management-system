import { Type } from 'class-transformer';
import { IsDateString, IsInt, Min } from 'class-validator';

export class RegisterOfDamagesOrLossQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @IsDateString()
  salaryMonth!: string;
}
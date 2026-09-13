import { Type } from 'class-transformer';
import { IsDateString, IsInt, Min } from 'class-validator';

export class FnFSettlementEmployeesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @IsDateString()
  month!: string;
}
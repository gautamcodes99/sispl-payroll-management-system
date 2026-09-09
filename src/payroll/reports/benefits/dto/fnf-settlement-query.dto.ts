import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class FnFSettlementQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;
}
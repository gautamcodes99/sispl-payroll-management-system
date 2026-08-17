import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ReprocessPayrollDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payrollRunId!: number;
}

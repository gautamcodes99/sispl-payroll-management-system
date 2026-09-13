import { Type } from 'class-transformer';
import { IsDateString, IsInt, Min } from 'class-validator';

export class PayrollPreviewQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsDateString()
  salaryMonth!: string;
}
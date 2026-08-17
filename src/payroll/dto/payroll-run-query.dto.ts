import { IsDateString, IsOptional } from 'class-validator';

export class PayrollRunQueryDto {
  @IsOptional()
  @IsDateString()
  salaryMonth?: string;
}

import { IsDateString } from 'class-validator';

export class MonthlyManualDeductionSheetQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

import { IsDateString } from 'class-validator';

export class MonthlyPayrollPreviewQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

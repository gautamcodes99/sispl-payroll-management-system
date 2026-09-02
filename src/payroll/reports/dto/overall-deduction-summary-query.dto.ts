import { IsDateString } from 'class-validator';

export class OverallDeductionSummaryQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

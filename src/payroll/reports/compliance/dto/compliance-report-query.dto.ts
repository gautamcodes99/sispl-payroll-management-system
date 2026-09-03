import { IsDateString } from 'class-validator';

export class ComplianceReportQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

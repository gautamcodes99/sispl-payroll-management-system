import { IsDateString } from 'class-validator';

export class FinalizePayrollDto {
  @IsDateString()
  salaryMonth!: string;
}

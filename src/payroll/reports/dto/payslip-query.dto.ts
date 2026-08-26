import { IsDateString } from 'class-validator';

export class PayslipQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

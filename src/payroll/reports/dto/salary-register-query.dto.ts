import { IsDateString } from 'class-validator';

export class SalaryRegisterQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

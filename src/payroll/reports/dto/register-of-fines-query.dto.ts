import { IsDateString } from 'class-validator';

export class RegisterOfFinesQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

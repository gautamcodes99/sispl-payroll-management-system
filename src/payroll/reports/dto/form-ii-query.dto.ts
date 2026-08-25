import { IsDateString } from 'class-validator';

export class FormIiQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

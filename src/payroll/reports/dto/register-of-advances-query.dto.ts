import { IsDateString } from 'class-validator';

export class RegisterOfAdvancesQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

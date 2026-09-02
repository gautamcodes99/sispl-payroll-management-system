import { IsDateString } from 'class-validator';

export class RegisterOfDamagesOrLossQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

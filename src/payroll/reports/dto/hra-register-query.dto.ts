import { IsDateString } from 'class-validator';

export class HraRegisterQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

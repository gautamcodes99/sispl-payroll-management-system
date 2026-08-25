import { IsDateString } from 'class-validator';

export class BankTransferQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

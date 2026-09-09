import { IsDateString } from 'class-validator';

export class FnFSettlementEmployeesQueryDto {
  @IsDateString()
  month!: string;
}
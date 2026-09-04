import { IsDateString, IsNotEmpty } from 'class-validator';

export class LeftEmployeeReportQueryDto {
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @IsNotEmpty()
  @IsDateString()
  toDate!: string;
}

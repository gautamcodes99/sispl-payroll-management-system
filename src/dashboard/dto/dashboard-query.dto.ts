import {
  IsDateString,
  IsOptional,
} from 'class-validator';

export class DashboardQueryDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  salaryMonth?: string;
}

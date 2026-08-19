import { IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @IsDateString()
  date!: string;
}

import { IsDateString } from 'class-validator';

export class WageSheetQueryDto {
  @IsDateString()
  salaryMonth!: string;
}

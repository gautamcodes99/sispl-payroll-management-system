import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class MonthlyAttendanceQueryDto {
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  year!: number;
}

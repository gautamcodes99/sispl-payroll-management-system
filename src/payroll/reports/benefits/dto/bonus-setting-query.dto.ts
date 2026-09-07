import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BonusSettingQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  financialYear!: number;
}
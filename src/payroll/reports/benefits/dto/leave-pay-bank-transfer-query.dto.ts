import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class LeavePayBankTransferQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  year!: number;
}

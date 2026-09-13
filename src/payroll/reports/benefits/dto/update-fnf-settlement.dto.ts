import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class UpdateFnFSettlementDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @Type(() => Number)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 2,
  })
  @Min(0)
  uniformShoesRecovery!: number;

  @Type(() => Number)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 2,
  })
  @Min(0)
  otherPermissibleDeduction!: number;
}
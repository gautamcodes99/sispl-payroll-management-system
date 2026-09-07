import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum BonusSettingAction {
  SET_AMOUNT = 'SET_AMOUNT',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
}

export class UpdateBonusSettingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  financialYear!: number;

  @IsEnum(BonusSettingAction)
  action!: BonusSettingAction;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  cappingAmount?: number;
}
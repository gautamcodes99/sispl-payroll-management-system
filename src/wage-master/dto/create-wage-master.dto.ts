import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { WageMasterOtOption } from '@prisma/client';
import { CreateSpecialAllowanceSlabDto } from './create-special-allowance-slab.dto';

export class CreateWageMasterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basic: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  da: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hraPercentage?: number;

  @IsOptional()
  @IsEnum(WageMasterOtOption)
  otOption?: WageMasterOtOption;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpecialAllowanceSlabDto)
  specialAllowanceSlabs: CreateSpecialAllowanceSlabDto[];
}

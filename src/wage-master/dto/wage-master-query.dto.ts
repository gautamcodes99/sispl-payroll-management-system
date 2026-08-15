import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { WageMasterStatus } from '@prisma/client';

export class WageMasterQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId?: number;

  @IsOptional()
  @IsEnum(WageMasterStatus)
  status?: WageMasterStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

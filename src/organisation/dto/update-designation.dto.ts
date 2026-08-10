import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDesignationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  siteId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  designationName?: string;
}

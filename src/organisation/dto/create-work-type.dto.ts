import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkTypeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @IsString()
  @MaxLength(100)
  workTypeName!: string;
}

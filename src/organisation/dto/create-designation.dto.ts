import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDesignationDto {
  @Type(() => Number)
  @IsInt()
  departmentId!: number;

  @IsString()
  @IsNotEmpty()
  designationName!: string;
}

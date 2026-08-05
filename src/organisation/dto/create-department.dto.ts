import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepartmentDto {
  @Type(() => Number)
  @IsInt()
  workTypeId!: number;

  @IsString()
  @IsNotEmpty()
  departmentName!: string;
}

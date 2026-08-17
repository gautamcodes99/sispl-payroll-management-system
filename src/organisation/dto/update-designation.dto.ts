import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDesignationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  designationName?: string;
}

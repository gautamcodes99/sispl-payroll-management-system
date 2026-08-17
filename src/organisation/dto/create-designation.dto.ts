import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty()
  designationName!: string;
}

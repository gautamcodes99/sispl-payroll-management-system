import { IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeStatutoryDto {
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  uanNumber?: string;

  @IsOptional()
  @IsString()
  esicNumber?: string;
}

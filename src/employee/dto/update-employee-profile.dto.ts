import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeProfileDto {
  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

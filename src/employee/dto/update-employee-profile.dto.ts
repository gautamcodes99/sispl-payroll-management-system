import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateEmployeeProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  fatherName?: string | null;

  @IsOptional()
  @IsIn(['MARRIED', 'UNMARRIED'])
  maritalStatus?: 'MARRIED' | 'UNMARRIED';

  @IsOptional()
  @IsString()
  husbandName?: string | null;

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

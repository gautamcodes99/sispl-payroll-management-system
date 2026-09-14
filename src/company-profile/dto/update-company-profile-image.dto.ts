import {
  IsBoolean,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCompanyProfileImageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(150)
  caption?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

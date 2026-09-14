import {
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateCompanyProfileImageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(150)
  caption?: string;
}

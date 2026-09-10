import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCompanyProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  companyName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  registeredAddress?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  communicationAddress?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ValidateIf(
    (object: UpdateCompanyProfileDto) =>
      object.email !== undefined && object.email !== '',
  )
  @IsString()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(250)
  website?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(20)
  pan?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(20)
  tan?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(25)
  gstin?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(30)
  cin?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  pfEstablishmentCode?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  esicEmployerCode?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  ptaxRegistrationNumber?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  mlwfRegistrationNumber?: string;
}
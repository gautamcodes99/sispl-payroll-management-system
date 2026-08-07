import { IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeNomineeDto {
  @IsOptional()
  @IsString()
  nomineeName?: string;

  @IsOptional()
  @IsString()
  nomineeRelationship?: string;

  @IsOptional()
  @IsString()
  nomineeMobile?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeAddressDto {
  @IsOptional()
  @IsString()
  presentAddress?: string;

  @IsOptional()
  @IsString()
  permanentAddress?: string;
}

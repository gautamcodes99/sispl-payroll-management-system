import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateEmployeeStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'TERMINATED';

  @IsOptional()
  @IsString()
  leftReason?: string;

  @IsOptional()
  @IsDateString()
  leftDate?: string;
}

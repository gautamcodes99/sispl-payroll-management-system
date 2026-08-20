import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportEmployeeRowDto {
  @Type(() => Number)
  @IsNumber()
  rowNumber!: number;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  joiningDate!: string;

  @IsString()
  designation!: string;

  @Type(() => Number)
  @IsNumber()
  basicSalary!: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'TERMINATED';

  @IsOptional()
  @IsString()
  leftReason?: string;

  @IsOptional()
  @IsString()
  leftDate?: string;

  @IsOptional()
  @IsString()
  presentAddress?: string;

  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

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

export class ImportEmployeesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ImportEmployeeRowDto)
  employees!: ImportEmployeeRowDto[];
}

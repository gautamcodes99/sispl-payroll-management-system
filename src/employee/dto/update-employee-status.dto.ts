import { IsIn } from 'class-validator';

export class UpdateEmployeeStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'TERMINATED';
}

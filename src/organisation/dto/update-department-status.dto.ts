import { IsEnum } from 'class-validator';
import { Status } from '../../common/enums/status.enum';

export class UpdateDepartmentStatusDto {
  @IsEnum(Status)
  status!: Status;
}

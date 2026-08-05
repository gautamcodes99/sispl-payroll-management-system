import { IsEnum } from 'class-validator';
import { Status } from '../../common/enums/status.enum';

export class UpdateWorkTypeStatusDto {
  @IsEnum(Status)
  status!: Status;
}

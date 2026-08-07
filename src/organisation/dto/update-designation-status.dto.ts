import { IsEnum } from 'class-validator';
import { Status } from '../../common/enums/status.enum';

export class UpdateDesignationStatusDto {
  @IsEnum(Status)
  status!: Status;
}

import { IsEnum } from 'class-validator';
import { Status } from '../enums/status.enum';

export class UpdateStatusDto {
  @IsEnum(Status)
  status!: Status;
}

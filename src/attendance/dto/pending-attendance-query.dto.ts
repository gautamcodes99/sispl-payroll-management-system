import { IsDateString } from 'class-validator';

export class PendingAttendanceQueryDto {
  @IsDateString()
  attendanceDate!: Date;
}

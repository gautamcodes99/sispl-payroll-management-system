import { IsDateString } from 'class-validator';

export class AttendanceDashboardQueryDto {
  @IsDateString()
  attendanceDate!: Date;
}

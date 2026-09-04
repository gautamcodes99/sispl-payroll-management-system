import { IsDateString, IsNotEmpty } from 'class-validator';

export class JoiningRegisterQueryDto {
  @IsNotEmpty()
  @IsDateString()
  month!: string;
}

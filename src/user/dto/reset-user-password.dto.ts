import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter.',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter.',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number.',
  })
  newPassword!: string;
}
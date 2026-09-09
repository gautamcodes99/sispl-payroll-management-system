import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Z]/, {
    message: 'New password must contain at least one uppercase letter.',
  })
  @Matches(/[a-z]/, {
    message: 'New password must contain at least one lowercase letter.',
  })
  @Matches(/[0-9]/, {
    message: 'New password must contain at least one number.',
  })
  newPassword!: string;
}
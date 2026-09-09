import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import type { AuthenticatedUser } from '../authenticated-user.type';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../service/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.me(currentUser);
  }

  @Patch('change-password')
  changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      currentUser,
      changePasswordDto,
    );
  }
}

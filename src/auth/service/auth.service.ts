import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthenticatedUser } from '../authenticated-user.type';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { UserRepository } from '../../user/repository/user.repository';

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 10;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async login(loginDto: LoginDto) {
    const email = this.normalizeEmail(loginDto.email);

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const expiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '8h',
    );

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        expiresIn: expiresIn as any,
      },
    );

    return {
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    };
  }

  async me(currentUser: AuthenticatedUser) {
    return {
      success: true,
      message: 'Current user fetched successfully.',
      data: currentUser,
    };
  }

  async changePassword(
    currentUser: AuthenticatedUser,
    changePasswordDto: ChangePasswordDto,
  ) {
    const user = await this.userRepository.findByEmail(currentUser.email);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const currentPasswordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const samePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.passwordHash,
    );

    if (samePassword) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    const passwordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      this.passwordSaltRounds,
    );

    await this.userRepository.updatePassword(user.id, passwordHash);

    return {
      success: true,
      message: 'Password changed successfully.',
      data: null,
    };
  }
}
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from '../dto/create-user.dto';
import { ResetUserPasswordDto } from '../dto/reset-user-password.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  private readonly passwordSaltRounds = 10;

  constructor(private readonly userRepository: UserRepository) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async findAll() {
    const users = await this.userRepository.findAll();

    return {
      success: true,
      message: 'Users fetched successfully.',
      data: users,
    };
  }

  async findById(id: number) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      success: true,
      message: 'User fetched successfully.',
      data: user,
    };
  }

  async create(createUserDto: CreateUserDto) {
    const fullName = createUserDto.fullName.trim();
    const email = this.normalizeEmail(createUserDto.email);

    if (!fullName) {
      throw new BadRequestException('Full name is required.');
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      this.passwordSaltRounds,
    );

    const user = await this.userRepository.create({
      fullName,
      email,
      passwordHash,
      role: createUserDto.role,
    });

    return {
      success: true,
      message: 'User created successfully.',
      data: user,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const existingUser = await this.userRepository.findById(id);

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    const data: {
      fullName?: string;
      email?: string;
      role?: UserRole;
    } = {};

    if (updateUserDto.fullName !== undefined) {
      const fullName = updateUserDto.fullName.trim();

      if (!fullName) {
        throw new BadRequestException('Full name is required.');
      }

      data.fullName = fullName;
    }

    if (updateUserDto.email !== undefined) {
      const email = this.normalizeEmail(updateUserDto.email);

      const emailOwner = await this.userRepository.findByEmail(email);

      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictException('A user with this email already exists.');
      }

      data.email = email;
    }

    if (
      updateUserDto.role !== undefined &&
      updateUserDto.role !== existingUser.role
    ) {
      if (
        existingUser.role === UserRole.SUPER_ADMIN &&
        existingUser.status === UserStatus.ACTIVE &&
        updateUserDto.role !== UserRole.SUPER_ADMIN
      ) {
        const activeSuperAdmins =
          await this.userRepository.countActiveSuperAdmins();

        if (activeSuperAdmins <= 1) {
          throw new ConflictException(
            'The last active Super Admin cannot be changed to another role.',
          );
        }
      }

      data.role = updateUserDto.role;
    }

    const user = await this.userRepository.update(id, data);

    return {
      success: true,
      message: 'User updated successfully.',
      data: user,
    };
  }

  async updateStatus(
    id: number,
    updateUserStatusDto: UpdateUserStatusDto,
  ) {
    const existingUser = await this.userRepository.findById(id);

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    if (
      existingUser.role === UserRole.SUPER_ADMIN &&
      existingUser.status === UserStatus.ACTIVE &&
      updateUserStatusDto.status === UserStatus.INACTIVE
    ) {
      const activeSuperAdmins =
        await this.userRepository.countActiveSuperAdmins();

      if (activeSuperAdmins <= 1) {
        throw new ConflictException(
          'The last active Super Admin cannot be deactivated.',
        );
      }
    }

    const user = await this.userRepository.updateStatus(
      id,
      updateUserStatusDto.status,
    );

    return {
      success: true,
      message: 'User status updated successfully.',
      data: user,
    };
  }

  async resetPassword(
    id: number,
    resetUserPasswordDto: ResetUserPasswordDto,
  ) {
    const existingUser = await this.userRepository.findById(id);

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    const passwordHash = await bcrypt.hash(
      resetUserPasswordDto.newPassword,
      this.passwordSaltRounds,
    );

    const user = await this.userRepository.updatePassword(id, passwordHash);

    return {
      success: true,
      message: 'User password reset successfully.',
      data: user,
    };
  }

  async findAuthenticationUserByEmail(email: string) {
    return this.userRepository.findByEmail(this.normalizeEmail(email));
  }
}
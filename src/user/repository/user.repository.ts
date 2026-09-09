import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly safeUserSelect = {
    id: true,
    fullName: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect;

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      select: this.safeUserSelect,
    });
  }

  async create(data: {
    fullName: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }) {
    return this.prisma.user.create({
      data,
      select: this.safeUserSelect,
    });
  }

  async update(
    id: number,
    data: {
      fullName?: string;
      email?: string;
      role?: UserRole;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: this.safeUserSelect,
    });
  }

  async updateStatus(id: number, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: this.safeUserSelect,
    });
  }

  async updatePassword(id: number, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: this.safeUserSelect,
    });
  }

  async countActiveSuperAdmins() {
    return this.prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }
}
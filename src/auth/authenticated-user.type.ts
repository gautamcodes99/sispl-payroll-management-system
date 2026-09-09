import { UserRole, UserStatus } from '@prisma/client';

export type AuthenticatedUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};
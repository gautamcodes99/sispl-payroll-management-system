import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_SALT_ROUNDS = 10;

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function validatePassword(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `BOOTSTRAP_SUPER_ADMIN_PASSWORD must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD must contain at least one uppercase letter.',
    );
  }

  if (!/[a-z]/.test(password)) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD must contain at least one lowercase letter.',
    );
  }

  if (!/[0-9]/.test(password)) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD must contain at least one number.',
    );
  }
}

async function bootstrapSuperAdmin(): Promise<void> {
  const fullName = getRequiredEnvironmentVariable(
    'BOOTSTRAP_SUPER_ADMIN_NAME',
  );
  const email = getRequiredEnvironmentVariable(
    'BOOTSTRAP_SUPER_ADMIN_EMAIL',
  ).toLowerCase();
  const password = getRequiredEnvironmentVariable(
    'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
  );

  validatePassword(password);

  const existingUserCount = await prisma.user.count();

  if (existingUserCount > 0) {
    throw new Error(
      'Bootstrap refused: system users already exist. Create additional users through User Management.',
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    PASSWORD_SALT_ROUNDS,
  );

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  });

  console.log('Initial Super Admin created successfully.');
  console.log(`ID: ${user.id}`);
  console.log(`Name: ${user.fullName}`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Status: ${user.status}`);
}

bootstrapSuperAdmin()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown bootstrap error.';

    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
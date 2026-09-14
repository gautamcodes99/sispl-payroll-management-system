import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
  );

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Company gallery images only.
  app.useStaticAssets(
    join(
      process.cwd(),
      'uploads',
      'company-gallery',
    ),
    {
      prefix: '/uploads/company-gallery/',
    },
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `🚀 SISPL Payroll API is running on: http://localhost:${process.env.PORT ?? 3000}/api/v1`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

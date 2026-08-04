import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

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

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `🚀 SISPL Payroll API is running on: http://localhost:${process.env.PORT ?? 3000}/api/v1`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

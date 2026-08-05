import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002':
        throw new ConflictException('Record already exists.');

      case 'P2025':
        throw new NotFoundException('Record not found.');

      default:
        console.log(exception);
        console.log('Code:', exception.code);

        response.status(500).json({
          success: false,
          message: 'Internal server error.',
        });
    }
  }
}

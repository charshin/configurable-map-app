import type { ApiErrorBody, ApiErrorCode } from '@confmap/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiException } from './api.exception.js';

const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.BAD_GATEWAY]: 'UPSTREAM_UNAVAILABLE',
};

/** Gives every error response the same `{ error: { code, message, details? } }` shape. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toBody(exception);
    response.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: { error: { code: exception.code, message: exception.message, details: exception.details } },
      };
    }
    if (exception instanceof HttpException) {
      // Nest's own errors, e.g. 404 for an unknown route or 400 for malformed JSON.
      const status = exception.getStatus();
      return {
        status,
        body: { error: { code: CODE_BY_STATUS[status] ?? 'INTERNAL', message: exception.message } },
      };
    }
    // Anything else is a bug or an infrastructure failure: log it, don't leak it.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL', message: 'Something went wrong' } },
    };
  }
}

import type { ApiErrorCode } from '@confmap/shared';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * An error with one of the API's error codes. The global filter turns it into
 * `{ error: { code, message, details? } }`.
 */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(message = 'Not found') {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
  }

  static unauthenticated(message = 'This request needs a user. Send the X-User-Id header.') {
    return new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
  }

  static forbidden(message: string) {
    return new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }

  static validation(message: string, details?: unknown) {
    return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', message, details);
  }
}

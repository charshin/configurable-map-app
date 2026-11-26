import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ApiException } from './api.exception.js';

/**
 * Validates `@Body({ schema })`, `@Query(..., { schema })` and `@Param(..., { schema })`
 * against the shared zod schemas, and reports failures in the API's error shape:
 * `details` lists each issue with its path, so a client can show it next to the field.
 */
export function createValidationPipe() {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      ApiException.validation(
        'Request validation failed',
        issues.map((issue) => ({
          path: (issue.path ?? []).map((segment) =>
            typeof segment === 'object' ? segment.key : segment,
          ),
          message: issue.message,
        })),
      ),
  });
}

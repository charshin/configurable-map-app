import { USER_ID_HEADER, usernameSchema } from '@confmap/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from './api.exception.js';

/**
 * The caller's username, from the `X-User-Id` header set by the web app.
 *
 * This is the authentication extension point. The header is trusted because
 * the assignment has no real auth. With SSO, the web app would forward a signed
 * token instead, and this decorator (or a guard in front of it) would verify it
 * and return the user from its claims.
 *
 * `@UserId()` returns `undefined` when the header is absent.
 * `@UserId({ required: true })` responds 401 instead.
 */
export const UserId = createParamDecorator(
  (options: { required?: boolean } | undefined, ctx: ExecutionContext): string | undefined => {
    const raw = ctx.switchToHttp().getRequest<Request>().header(USER_ID_HEADER);
    if (raw === undefined || raw === '') {
      if (options?.required) throw ApiException.unauthenticated();
      return undefined;
    }
    const result = usernameSchema.safeParse(raw);
    if (!result.success) {
      throw ApiException.validation(`Invalid ${USER_ID_HEADER} header`, {
        issues: result.error.issues.map((issue) => issue.message),
      });
    }
    return result.data;
  },
);

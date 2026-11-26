import 'server-only';
import { type ApiErrorCode, apiErrorBodySchema, USER_ID_HEADER } from '@confmap/shared';
import type { z } from 'zod';

/** An error response from the API, in its `{ error: { code, message, details? } }` shape. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBaseUrl(): string {
  const url = process.env.API_URL;
  if (!url) throw new Error('API_URL is not set (see apps/web/.env.example)');
  return url.replace(/\/+$/, '');
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Sent as X-User-Id. This BFF is the only caller of the API. */
  userId?: string | null;
}

/**
 * Calls the NestJS API from the server (Server Components and Server Actions
 * only; the browser never talks to the API). Responses are validated against
 * the shared schema, so a contract drift fails loudly here instead of deep in
 * the UI.
 */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  { method = 'GET', body, userId }: RequestOptions = {},
): Promise<z.output<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (userId) headers[USER_ID_HEADER] = userId;

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = apiErrorBodySchema.safeParse(json);
    if (error.success) {
      const { code, message, details } = error.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, 'INTERNAL', `The API responded with HTTP ${response.status}`);
  }
  return schema.parse(json);
}

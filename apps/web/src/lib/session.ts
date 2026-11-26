import 'server-only';
import { usernameSchema } from '@confmap/shared';
import { cookies } from 'next/headers';

export const USERNAME_COOKIE = 'confmap-username';

/**
 * The signed-in username, or null. A stand-in for real authentication: there's
 * no password, the cookie just names the user. With SSO this would read and
 * verify a session instead, and the API client would forward a token.
 *
 * Reading cookies makes the caller request-time, so call it inside a
 * `<Suspense>` boundary and pass the result to cached functions as an argument.
 */
export async function getUsername(): Promise<string | null> {
  const raw = (await cookies()).get(USERNAME_COOKIE)?.value;
  const result = usernameSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Signs the user in as `username`. Server Actions only. */
export async function setUsernameCookie(username: string): Promise<void> {
  (await cookies()).set(USERNAME_COOKIE, username, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Signs the user out. Server Actions only. */
export async function clearUsernameCookie(): Promise<void> {
  (await cookies()).delete(USERNAME_COOKIE);
}

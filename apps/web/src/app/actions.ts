'use server';

import {
  configurationDtoSchema,
  configurationNameSchema,
  configurationSchema,
  usernameSchema,
} from '@confmap/shared';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api/client';
import { cacheTags } from '@/lib/api/tags';
import { DATASET_ID } from '@/lib/dataset';
import { clearUsernameCookie, getUsername, setUsernameCookie } from '@/lib/session';

// The app's writes. Each calls the API from the server, then expires the cache
// tags the write affects with `updateTag`, so the re-render that comes back
// with the action's response already shows the change (read-your-own-writes).

export type ActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> };

function fieldErrors(error: z.ZodError): ActionState {
  return {
    status: 'error',
    message: 'Check the highlighted fields.',
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function apiFailure(error: unknown): ActionState {
  if (error instanceof ApiError) return { status: 'error', message: error.message };
  console.error(error);
  return { status: 'error', message: 'Something went wrong. Try again.' };
}

const usernameFormSchema = z.object({ username: usernameSchema });

/** Signs in (or switches user). The cookie change re-renders the route. */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = usernameFormSchema.safeParse({ username: formData.get('username') });
  if (!parsed.success) return fieldErrors(parsed.error);
  await setUsernameCookie(parsed.data.username);
  return { status: 'success' };
}

export async function signOut(): Promise<void> {
  await clearUsernameCookie();
}

const saveFormSchema = z.object({
  name: configurationNameSchema,
  publish: z.boolean(),
  config: z
    .string()
    .transform((text, ctx) => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid configuration' });
        return z.NEVER;
      }
    })
    .pipe(configurationSchema),
});

/**
 * Save as…: always creates a new configuration owned by the user (saved
 * configurations are never updated). A signed-out user names themselves in the
 * same form. On success it opens the new configuration at its share link.
 */
export async function saveConfiguration(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let username = await getUsername();
  if (!username) {
    const parsed = usernameFormSchema.safeParse({ username: formData.get('username') });
    if (!parsed.success) return fieldErrors(parsed.error);
    username = parsed.data.username;
    await setUsernameCookie(username);
  }

  const parsed = saveFormSchema.safeParse({
    name: formData.get('name'),
    publish: formData.get('publish') === 'on',
    config: formData.get('config'),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  let id: string;
  try {
    const created = await apiRequest(
      `/datasets/${encodeURIComponent(DATASET_ID)}/configurations`,
      configurationDtoSchema,
      { method: 'POST', body: parsed.data, userId: username },
    );
    id = created.id;
  } catch (error) {
    return apiFailure(error);
  }

  updateTag(cacheTags.ownedConfigurations(username));
  if (parsed.data.publish) updateTag(cacheTags.publishedConfigurations(DATASET_ID));
  redirect(`/c/${id}`);
}

/** Publishes the user's own configuration. Publishing can't be undone. */
export async function publishConfiguration(id: string): Promise<ActionState> {
  const username = await getUsername();
  if (!username) return { status: 'error', message: 'Sign in to publish.' };
  if (!z.uuid().safeParse(id).success) return { status: 'error', message: 'Configuration not found.' };

  try {
    await apiRequest(`/configurations/${encodeURIComponent(id)}/publish`, configurationDtoSchema, {
      method: 'POST',
      userId: username,
    });
  } catch (error) {
    return apiFailure(error);
  }

  updateTag(cacheTags.configuration(id));
  updateTag(cacheTags.ownedConfigurations(username));
  updateTag(cacheTags.publishedConfigurations(DATASET_ID));
  return { status: 'success' };
}

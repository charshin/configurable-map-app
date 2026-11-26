import { Skeleton } from '@/components/ui/skeleton';
import { getUsername } from '@/lib/session';
import { UserChipClient } from './user-chip-client';

/**
 * Reads the username cookie, so it's request-time: the layout renders it inside
 * <Suspense>. It's the only place the client store learns the username.
 */
export async function UserChip() {
  return <UserChipClient username={await getUsername()} />;
}

export function UserChipSkeleton() {
  return <Skeleton className="h-8 w-24 rounded-full" />;
}

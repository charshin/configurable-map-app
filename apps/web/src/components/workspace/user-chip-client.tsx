'use client';

import { useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWorkspaceActions } from './workspace-store';

/**
 * Shows who's signed in and shares the username with the rest of the
 * workspace through the store. (Changing user comes in Phase 4.)
 */
export function UserChipClient({ username }: { username: string | null }) {
  const { setUsername } = useWorkspaceActions();
  useEffect(() => setUsername(username), [setUsername, username]);

  if (!username) {
    return (
      <span data-testid="user-chip" className="text-sm text-muted-foreground">
        Not signed in
      </span>
    );
  }
  return (
    <span data-testid="user-chip" className="flex items-center gap-2 text-sm font-medium">
      <Avatar size="sm">
        <AvatarFallback>{username.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      {username}
    </span>
  );
}

'use client';

import { UserIcon } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { type ActionState, signIn, signOut } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useWorkspaceActions } from './workspace-store';

const initialState: ActionState = { status: 'idle' };

/**
 * Shows who's signed in and shares the username with the rest of the
 * workspace through the store. Opens a dialog to sign in, switch user or sign
 * out; the cookie change re-renders the route with the new user's data.
 */
export function UserChipClient({ username }: { username: string | null }) {
  const { setUsername } = useWorkspaceActions();
  useEffect(() => setUsername(username), [setUsername, username]);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" data-testid="user-chip" />}>
        {username ? (
          <>
            <Avatar size="sm">
              <AvatarFallback>{username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            {username}
          </>
        ) : (
          <>
            <UserIcon data-icon="inline-start" />
            Sign in
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        {/* Mounted only while open, so the form starts fresh each time. */}
        {open && <UserForm username={username} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ username, onDone }: { username: string | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [signingOut, startSignOut] = useTransition();
  const error = state.status === 'error' ? (state.fieldErrors?.username?.[0] ?? state.message) : undefined;

  useEffect(() => {
    if (state.status === 'success') onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{username ? 'Switch user' : 'Sign in'}</DialogTitle>
        <DialogDescription>
          Pick a username to save and publish configurations. There&apos;s no password: this is a stand-in for
          real sign-in.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            name="username"
            defaultValue={username ?? ''}
            autoComplete="username"
            autoFocus
            required
            maxLength={40}
            aria-invalid={error ? true : undefined}
          />
          <FieldDescription>Letters, numbers, dots, dashes or underscores.</FieldDescription>
          <FieldError>{error}</FieldError>
        </Field>
      </FieldGroup>
      <DialogFooter>
        {username && (
          <Button
            type="button"
            variant="ghost"
            className="sm:mr-auto"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                await signOut();
                onDone();
              })
            }
          >
            Sign out
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : username ? 'Switch' : 'Sign in'}
        </Button>
      </DialogFooter>
    </form>
  );
}

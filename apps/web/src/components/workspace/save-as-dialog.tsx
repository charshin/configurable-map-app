'use client';

import type { Configuration } from '@confmap/shared';
import { SaveIcon } from 'lucide-react';
import { useActionState, useState } from 'react';
import { type ActionState, saveConfiguration } from '@/app/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useWorkspace } from './workspace-store';

const initialState: ActionState = { status: 'idle' };

/**
 * Save as…: saves the draft as a new configuration. Saved configurations are
 * never updated, so this is the only way to save. A signed-out user also picks
 * a username here. On success the action opens the new configuration.
 */
export function SaveAsDialog({ draft, disabled }: { draft: Configuration; disabled: boolean }) {
  const username = useWorkspace((state) => state.username);
  const [state, formAction, pending] = useActionState(saveConfiguration, initialState);
  const [publish, setPublish] = useState(false);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  // Errors with no field in this form (API failures, an invalid draft) show as an alert.
  const formError =
    state.status === 'error' && !errors?.username && !errors?.name
      ? (errors?.config?.[0] ?? state.message)
      : undefined;

  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={disabled} />}>
        <SaveIcon data-icon="inline-start" />
        Save as…
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Save as a new configuration</DialogTitle>
            <DialogDescription>Saves the current map style and columns under a new name.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {typeof username !== 'string' && (
              <Field data-invalid={errors?.username ? true : undefined}>
                <FieldLabel htmlFor="save-username">Your name</FieldLabel>
                <Input
                  id="save-username"
                  name="username"
                  autoComplete="username"
                  required
                  aria-invalid={errors?.username ? true : undefined}
                />
                <FieldDescription>No password. It labels what you save and publish.</FieldDescription>
                <FieldError>{errors?.username?.[0]}</FieldError>
              </Field>
            )}
            <Field data-invalid={errors?.name ? true : undefined}>
              <FieldLabel htmlFor="save-name">Name</FieldLabel>
              <Input
                id="save-name"
                name="name"
                maxLength={80}
                required
                autoFocus
                placeholder="e.g. Tall trees by height"
                aria-invalid={errors?.name ? true : undefined}
              />
              <FieldError>{errors?.name?.[0]}</FieldError>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="save-publish" checked={publish} onCheckedChange={setPublish} />
              <FieldLabel htmlFor="save-publish" className="font-normal">
                Publish now, so everyone can use it
              </FieldLabel>
              {publish && <input type="hidden" name="publish" value="on" />}
            </Field>
          </FieldGroup>
          <input type="hidden" name="config" value={JSON.stringify(draft)} />
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

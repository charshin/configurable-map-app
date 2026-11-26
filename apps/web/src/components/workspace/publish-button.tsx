'use client';

import { GlobeIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { publishConfiguration } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/** Publishes the owner's private configuration, after a confirmation. */
export function PublishButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const publish = () => {
    setOpen(false);
    startTransition(async () => {
      const result = await publishConfiguration(id);
      if (result.status === 'error') toast.error("Couldn't publish", { description: result.message });
      else toast.success('Published', { description: `Everyone can now find "${name}" under Published.` });
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="sm" disabled={pending} />}>
        <GlobeIcon data-icon="inline-start" />
        {pending ? 'Publishing…' : 'Publish'}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Everyone will see it in the Published list and can open its link. Publishing can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={publish}>Publish</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

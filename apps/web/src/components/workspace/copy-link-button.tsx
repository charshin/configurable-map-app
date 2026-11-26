'use client';

import { LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Copies the configuration's share link (`/c/<id>`). */
export function CopyLinkButton({ id }: { id: string }) {
  const copy = async () => {
    const url = new URL(`/c/${id}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', { description: url });
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      <LinkIcon data-icon="inline-start" />
      Copy link
    </Button>
  );
}

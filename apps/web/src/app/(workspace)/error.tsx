'use client';

import { AlertCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Alert variant="destructive">
        <AlertCircleIcon aria-hidden />
        <AlertTitle>Couldn&apos;t load the configuration</AlertTitle>
        <AlertDescription>The configuration service didn&apos;t respond. Check that the API is running.</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={() => retry()} className="self-start">
        Try again
      </Button>
    </div>
  );
}

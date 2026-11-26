import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">There&apos;s nothing at this address.</p>
      <Button nativeButton={false} render={<Link href="/" />}>Back to the map</Button>
    </main>
  );
}

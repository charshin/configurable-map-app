import { LayersIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export function AppHeader({ datasetName, children }: { datasetName: string; children: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <Link href="/" className="flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MapPinIcon aria-hidden />
        </span>
        Configurable Map
      </Link>
      <Separator orientation="vertical" className="h-6 self-center" />
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <LayersIcon aria-hidden className="size-4 shrink-0" />
        <span className="hidden sm:inline">Dataset</span>
        <span data-testid="dataset-name" className="truncate font-medium text-foreground">
          {datasetName}
        </span>
      </div>
      <div className="ml-auto">{children}</div>
    </header>
  );
}

'use client';

import type { DatasetDto } from '@confmap/shared';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// The ArcGIS SDK needs `window`, so it only loads in the browser. The skeleton
// is what the prerendered HTML shows in its place.
const ArcgisMap = dynamic(() => import('./arcgis-map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapPanel({ dataset }: { dataset: DatasetDto }) {
  return <ArcgisMap dataset={dataset} />;
}

function MapSkeleton() {
  return (
    <div className="flex size-full flex-col" aria-label="Loading map" role="status">
      <Skeleton className="min-h-0 flex-1 rounded-none" />
      <Skeleton className="h-[35vh] shrink-0 rounded-none border-t bg-muted/60" />
    </div>
  );
}

import { Suspense } from 'react';
import { MapPanel } from '@/components/map/map-panel';
import { AppHeader } from '@/components/workspace/app-header';
import { UserChip, UserChipSkeleton } from '@/components/workspace/user-chip';
import { WorkspaceProvider } from '@/components/workspace/workspace-store';
import { getDataset } from '@/lib/api/queries';
import { DATASET_ID } from '@/lib/dataset';

/**
 * The workspace: header, sidebar and map. As a layout it persists while the
 * user switches configurations, so the ArcGIS map is created once.
 *
 * Everything here is static or cached except the user chip, which reads a
 * cookie and so streams in from behind its own <Suspense> boundary.
 */
export default async function WorkspaceLayout({ children }: LayoutProps<'/'>) {
  const dataset = await getDataset(DATASET_ID);

  return (
    <WorkspaceProvider>
      <div className="flex h-dvh flex-col">
        <AppHeader datasetName={dataset.name}>
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
        </AppHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside
            aria-label="Configuration"
            className="flex shrink-0 flex-col overflow-y-auto border-b bg-background md:w-90 md:border-r md:border-b-0"
          >
            {children}
          </aside>
          <main className="h-[70vh] min-w-0 md:h-auto md:flex-1">
            <MapPanel dataset={dataset} />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

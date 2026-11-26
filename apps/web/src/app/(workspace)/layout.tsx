import { Suspense } from 'react';
import { MapPanel } from '@/components/map/map-panel';
import { AppHeader } from '@/components/workspace/app-header';
import { ConfigPicker, PickerGroupSkeleton } from '@/components/workspace/config-picker';
import { MyConfigurations } from '@/components/workspace/my-configurations';
import { Sidebar, SidebarToggle } from '@/components/workspace/sidebar';
import { UserChip, UserChipSkeleton } from '@/components/workspace/user-chip';
import { WorkspaceProvider } from '@/components/workspace/workspace-store';
import {
  getDataset,
  getDatasetFields,
  getDefaultConfiguration,
  getPublishedConfigurations,
} from '@/lib/api/queries';
import { DATASET_ID } from '@/lib/dataset';

/**
 * The workspace: header, sidebar and map. As a layout it persists while the
 * user switches configurations, so the ArcGIS map is created once.
 *
 * Everything here is static or cached except the two parts that read the
 * username cookie (the user chip and the picker's "Mine" group), which stream
 * in from behind their own <Suspense> boundaries.
 */
export default async function WorkspaceLayout({ children }: LayoutProps<'/'>) {
  const [dataset, fields, defaultConfiguration, published] = await Promise.all([
    getDataset(DATASET_ID),
    getDatasetFields(DATASET_ID),
    getDefaultConfiguration(DATASET_ID),
    getPublishedConfigurations(DATASET_ID),
  ]);

  return (
    <WorkspaceProvider fields={fields}>
      <div className="flex h-dvh flex-col">
        <AppHeader datasetName={dataset.name} start={<SidebarToggle />}>
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
        </AppHeader>
        <div className="flex min-h-0 flex-1">
          <Sidebar>
            <div className="px-5 pt-5">
              <ConfigPicker
                defaultConfiguration={defaultConfiguration}
                published={published}
                mine={
                  <Suspense fallback={<PickerGroupSkeleton />}>
                    <MyConfigurations />
                  </Suspense>
                }
              />
            </div>
            {children}
          </Sidebar>
          <main className="isolate min-w-0 flex-1">
            <MapPanel dataset={dataset} />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

'use client';

import type { ConfigurationDto } from '@confmap/shared';
import { GlobeIcon, LockIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace, useWorkspaceActions } from './workspace-store';

/**
 * The configuration-specific part of the sidebar. Each page renders it with its
 * configuration as props, so the prerendered HTML already shows the real values
 * (not a skeleton waiting for client state). On mount it selects the
 * configuration in the store, which the map in the layout reads.
 */
export function ConfigPanel({ configuration }: { configuration: ConfigurationDto }) {
  const { select } = useWorkspaceActions();
  useEffect(() => select(configuration), [select, configuration]);

  return (
    <div className="flex flex-col gap-4 p-5">
      <ConfigCard configuration={configuration} />
    </div>
  );
}

function ConfigCard({ configuration }: { configuration: ConfigurationDto }) {
  const username = useWorkspace((state) => state.username);
  const owner =
    configuration.ownerId === null ? null : configuration.ownerId === username ? 'you' : configuration.ownerId;

  return (
    <section aria-labelledby="config-name" className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground">CONFIGURATION</span>
      <h1 id="config-name" data-testid="config-name" className="text-lg font-semibold">
        {configuration.name}
      </h1>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {configuration.isDefault && <Badge>Default</Badge>}
        {owner && <span>by {owner}</span>}
        {configuration.visibility === 'PUBLISHED' ? (
          <Badge variant="secondary">
            <GlobeIcon data-icon="inline-start" aria-hidden />
            Published
          </Badge>
        ) : (
          <Badge variant="secondary">
            <LockIcon data-icon="inline-start" aria-hidden />
            Private
          </Badge>
        )}
      </div>
    </section>
  );
}

/** Shown while a page's configuration is still loading. */
export function ConfigPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading configuration">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-5 w-36" />
    </div>
  );
}

'use client';

import { type ConfigurationDto, findUnknownFields } from '@confmap/shared';
import { GlobeIcon, LockIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useId } from 'react';
import { ColumnsEditor } from '@/components/editors/columns-editor';
import { validateDraft } from '@/components/editors/issues';
import { MapStyleEditor } from '@/components/editors/map-style-editor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyLinkButton } from './copy-link-button';
import { PublishButton } from './publish-button';
import { SaveAsDialog } from './save-as-dialog';
import { useDatasetFields, useIsDirty, useWorkspace, useWorkspaceActions } from './workspace-store';

/** Why a page shows something other than what the URL asked for. */
export type ConfigNotice = 'unavailable';

/**
 * The configuration-specific part of the sidebar: card, editors and footer.
 * Each page renders it with its configuration as props, so the prerendered
 * HTML already shows the real values (not a skeleton waiting for client
 * state). On mount it selects the configuration in the store, which the map
 * in the layout reads; edits then go to the store's draft.
 */
export function ConfigPanel({
  configuration,
  notice,
}: {
  configuration: ConfigurationDto;
  notice?: ConfigNotice;
}) {
  const { select, updateDraft, resetDraft } = useWorkspaceActions();
  useEffect(() => select(configuration), [select, configuration]);

  const fields = useDatasetFields();
  // Before the effect above runs (and in the prerendered HTML), the store
  // still holds the previous selection: show this configuration's own values.
  const storeDraft = useWorkspace((state) => (state.selected?.id === configuration.id ? state.draft : null));
  const draft = storeDraft ?? configuration.config;
  const dirty = useIsDirty() && storeDraft !== null;
  const issues = validateDraft(draft);
  const unknownFields = fields.length > 0 ? findUnknownFields(draft, fields.map((field) => field.name)) : [];

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 p-5">
        {notice === 'unavailable' && (
          <Alert data-testid="config-notice">
            <TriangleAlertIcon />
            <AlertTitle>This configuration isn&apos;t available</AlertTitle>
            <AlertDescription>
              It may be private to someone else, or the link may be wrong. Showing the default instead.
            </AlertDescription>
          </Alert>
        )}
        <ConfigCard configuration={configuration} />
      </div>

      <Tabs defaultValue="style" className="flex-1 gap-0">
        <TabsList className="mx-5 w-[calc(100%-2.5rem)]">
          <TabsTrigger value="style">Map style</TabsTrigger>
          <TabsTrigger value="columns">Columns</TabsTrigger>
        </TabsList>
        {unknownFields.length > 0 && (
          <Alert variant="destructive" className="mx-5 mt-4 w-auto">
            <TriangleAlertIcon />
            <AlertTitle>Unknown fields</AlertTitle>
            <AlertDescription>
              This dataset has no {unknownFields.join(', ')}. Remove them before saving.
            </AlertDescription>
          </Alert>
        )}
        <TabsContent value="style" className="p-5">
          <MapStyleEditor
            symbolConfig={draft.symbolConfig}
            fields={fields}
            issues={issues}
            onChange={(symbolConfig) => updateDraft({ ...draft, symbolConfig })}
          />
        </TabsContent>
        <TabsContent value="columns" className="p-5">
          <ColumnsEditor
            columns={draft.tableConfig.columns}
            fields={fields}
            issues={issues}
            onChange={(columns) => updateDraft({ ...draft, tableConfig: { columns } })}
          />
        </TabsContent>
      </Tabs>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t bg-background px-5 py-3">
        <span className="mr-auto flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground" aria-live="polite">
          {dirty ? (
            <>
              <span aria-hidden className="size-2 rounded-full bg-amber-500" />
              Unsaved
            </>
          ) : (
            'Saved'
          )}
        </span>
        <Button type="button" variant="ghost" size="sm" disabled={!dirty} onClick={resetDraft}>
          <RotateCcwIcon data-icon="inline-start" />
          Reset
        </Button>
        <SaveAsDialog draft={draft} disabled={issues.size > 0 || unknownFields.length > 0} />
      </footer>
    </div>
  );
}

function ConfigCard({ configuration }: { configuration: ConfigurationDto }) {
  const username = useWorkspace((state) => state.username);
  const mine = configuration.ownerId !== null && configuration.ownerId === username;
  const owner = configuration.ownerId === null ? null : mine ? 'you' : configuration.ownerId;
  const isPrivate = configuration.visibility === 'PRIVATE';
  // Unique per instance: Next.js keeps the previous page mounted (hidden) after
  // navigating, so a fixed id would appear twice.
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground">CONFIGURATION</span>
        <h1 id={headingId} data-testid="config-name" className="text-lg font-semibold">
          {configuration.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {configuration.isDefault && <Badge>Default</Badge>}
          {owner && <span>by {owner}</span>}
          {isPrivate ? (
            <Badge variant="secondary" data-testid="visibility">
              <LockIcon data-icon="inline-start" aria-hidden />
              Private
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="visibility">
              <GlobeIcon data-icon="inline-start" aria-hidden />
              Published
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyLinkButton id={configuration.id} />
        {configuration.canPublish && isPrivate && (
          <PublishButton id={configuration.id} name={configuration.name} />
        )}
      </div>
      {isPrivate && (
        <p className="text-xs text-muted-foreground">Only you can open this link until it&apos;s published.</p>
      )}
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
      <Skeleton className="h-8 w-28" />
      <Skeleton className="mt-4 h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

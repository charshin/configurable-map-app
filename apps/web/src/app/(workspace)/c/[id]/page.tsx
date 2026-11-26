import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfigPanel, ConfigPanelSkeleton } from '@/components/workspace/config-panel';
import { getConfiguration, getDefaultConfiguration } from '@/lib/api/queries';
import { DATASET_ID } from '@/lib/dataset';
import { getUsername } from '@/lib/session';

export const metadata: Metadata = { title: 'Shared configuration · Configurable Map' };

/**
 * "/c/[id]": one saved configuration (the share link). The id is URL data, so
 * the page streams into the workspace layout behind a skeleton; the layout
 * (header, picker, map) is in the static shell and stays mounted.
 */
export default function ConfigurationPage({ params }: PageProps<'/c/[id]'>) {
  return (
    <Suspense fallback={<ConfigPanelSkeleton />}>
      <SelectedConfiguration params={params} />
    </Suspense>
  );
}

/**
 * Resolves what to show, without reading the cookie unless it has to:
 * 1. Anonymous lookup: system and published configurations, shared by everyone.
 * 2. Only if that fails, the cookie, then the lookup as that user: their own
 *    private configuration. That result is cached per user, so it never lands
 *    in an entry someone else could read.
 * 3. Otherwise (missing, or private to someone else) the default, with a notice.
 *    The API answers 404 for both, so this page can't tell them apart either.
 */
async function SelectedConfiguration({ params }: Pick<PageProps<'/c/[id]'>, 'params'>) {
  const { id } = await params;

  const shared = await getConfiguration(id);
  if (shared) return <ConfigPanel configuration={shared} />;

  const username = await getUsername();
  if (username) {
    const own = await getConfiguration(id, username);
    if (own) return <ConfigPanel configuration={own} />;
  }

  const fallback = await getDefaultConfiguration(DATASET_ID);
  return <ConfigPanel configuration={fallback} notice="unavailable" />;
}

'use client';

import type { ConfigurationSummaryDto } from '@confmap/shared';
import { CheckIcon, ChevronsUpDownIcon, GlobeIcon, LockIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, use, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsDirty, useWorkspace } from './workspace-store';

interface PickerContextValue {
  query: string;
  onLinkClick: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

const PickerContext = createContext<PickerContextValue>({ query: '', onLinkClick: () => {} });

/** Where a configuration opens. The default lives at "/", the static home page. */
export function configurationHref(configuration: Pick<ConfigurationSummaryDto, 'id' | 'isDefault'>): string {
  return configuration.isDefault ? '/' : `/c/${configuration.id}`;
}

/**
 * Picks a saved configuration. The Default and Published lists are cached
 * props, so they're in the static shell; `mine` is a server-rendered slot that
 * reads the cookie (inside its own Suspense boundary).
 *
 * Items are links that prefetch fully (`prefetch={true}`). They only mount
 * while the picker is open, so that prefetching starts on intent, not for
 * every visitor.
 */
export function ConfigPicker({
  defaultConfiguration,
  published,
  mine,
}: {
  defaultConfiguration: ConfigurationSummaryDto;
  published: ConfigurationSummaryDto[];
  mine: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirty = useIsDirty();
  const username = useWorkspace((state) => state.username);
  // The default has its own group, and your own published configurations are
  // already under Mine (until the username streams in, show them all).
  const others = published.filter(
    (configuration) =>
      configuration.id !== defaultConfiguration.id && (!username || configuration.ownerId !== username),
  );

  const onLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (dirty) {
      event.preventDefault();
      setPendingHref(href);
    }
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="w-full justify-between" data-testid="config-picker" />}
        >
          Browse configurations
          <ChevronsUpDownIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-0 p-0">
          <div className="relative border-b">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search configurations"
              placeholder="Search configurations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 rounded-none border-0 pl-9 shadow-none focus-visible:ring-0"
            />
          </div>
          <nav aria-label="Configurations" className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-1">
            <PickerContext value={{ query, onLinkClick }}>
              <PickerGroup heading="Default" items={[defaultConfiguration]} />
              {mine}
              <PickerGroup heading="Published by others" items={others} empty="Nothing published yet." />
            </PickerContext>
          </nav>
        </PopoverContent>
      </Popover>

      <AlertDialog open={pendingHref !== null} onOpenChange={(next) => !next && setPendingHref(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits haven&apos;t been saved. Use Save as… first to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingHref) router.push(pendingHref);
                setPendingHref(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** One group of the picker, filtered by the search box. Hidden when a search matches nothing in it. */
export function PickerGroup({
  heading,
  items,
  empty,
  showOwner = true,
}: {
  heading: string;
  items: ConfigurationSummaryDto[];
  /** Off for the user's own group, where every owner is them. */
  showOwner?: boolean;
  /** Shown when the group has no items at all (not when a search filters them out). */
  empty?: string;
}) {
  const { query } = use(PickerContext);
  const selectedId = useWorkspace((state) => state.selected?.id);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? items.filter(
        (item) => item.name.toLowerCase().includes(needle) || item.ownerId?.toLowerCase().includes(needle),
      )
    : items;
  if (matches.length === 0 && (needle || !empty)) return null;

  return (
    <div role="group" aria-label={heading} className="flex flex-col">
      <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{heading}</div>
      {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{empty}</p>}
      {matches.map((item) => (
        <PickerItem key={item.id} item={item} selected={item.id === selectedId} showOwner={showOwner} />
      ))}
    </div>
  );
}

function PickerItem({
  item,
  selected,
  showOwner,
}: {
  item: ConfigurationSummaryDto;
  selected: boolean;
  showOwner: boolean;
}) {
  const { onLinkClick } = use(PickerContext);
  const href = configurationHref(item);
  return (
    <Link
      href={href}
      prefetch={true}
      aria-current={selected ? 'page' : undefined}
      onClick={(event) => onLinkClick(event, href)}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'font-medium',
      )}
    >
      <CheckIcon aria-hidden className={cn('size-4 shrink-0 text-primary', !selected && 'invisible')} />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {showOwner && item.ownerId && <span className="shrink-0 text-xs text-muted-foreground">{item.ownerId}</span>}
      {item.visibility === 'PRIVATE' ? (
        <LockIcon aria-label="Private" className="size-3.5 shrink-0 text-muted-foreground" />
      ) : item.kind === 'CUSTOM' ? (
        <GlobeIcon aria-label="Published" className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </Link>
  );
}

export function PickerGroupSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-2 py-2" role="status" aria-label="Loading your configurations">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

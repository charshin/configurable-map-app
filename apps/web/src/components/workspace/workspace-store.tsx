'use client';

import type { Configuration, ConfigurationDto } from '@confmap/shared';
import { createContext, use, useState, useSyncExternalStore } from 'react';

/**
 * Client state shared by the sidebar, the map and the dialogs. It lives in the
 * workspace layout, so it survives navigation between configurations.
 *
 * Server data doesn't live here: it arrives as props from Server Components.
 * The store only holds what the browser owns: which configuration is selected,
 * the unsaved draft built from it, and who the user is.
 */
export interface WorkspaceState {
  /** `undefined` while the cookie-dependent part of the page streams in, `null` when signed out. */
  username: string | null | undefined;
  /** The saved configuration currently selected. */
  selected: ConfigurationDto | null;
  /** The configuration being edited and shown on the map. Starts as `selected.config`. */
  draft: Configuration | null;
}

type Listener = () => void;

function createWorkspaceStore() {
  let state: WorkspaceState = { username: undefined, selected: null, draft: null };
  const listeners = new Set<Listener>();

  const setState = (update: Partial<WorkspaceState>) => {
    state = { ...state, ...update };
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions: {
      setUsername(username: string | null) {
        if (state.username !== username) setState({ username });
      },
      /** Selects a saved configuration. Re-selecting the same one keeps the draft. */
      select(configuration: ConfigurationDto) {
        if (state.selected?.id === configuration.id) return;
        setState({ selected: configuration, draft: configuration.config });
      },
      updateDraft(draft: Configuration) {
        setState({ draft });
      },
      /** Discards unsaved edits. */
      resetDraft() {
        if (state.selected) setState({ draft: state.selected.config });
      },
    },
  };
}

type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createWorkspaceStore);
  return <WorkspaceContext value={store}>{children}</WorkspaceContext>;
}

function useStore(): WorkspaceStore {
  const store = use(WorkspaceContext);
  if (!store) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return store;
}

/**
 * Subscribes to part of the workspace state. Return a primitive or an existing
 * object from the selector (not a new object), so renders only happen when the
 * selected value actually changes.
 */
export function useWorkspace<T>(selector: (state: WorkspaceState) => T): T {
  const store = useStore();
  const get = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}

export function useWorkspaceActions() {
  return useStore().actions;
}

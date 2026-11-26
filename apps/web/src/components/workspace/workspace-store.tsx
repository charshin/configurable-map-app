'use client';

import type { Configuration, ConfigurationDto, DatasetFieldDto } from '@confmap/shared';
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
  /** Whether the sidebar is open on small screens (it's always shown from `md` up). */
  sidebarOpen: boolean;
}

type Listener = () => void;

const initialState: WorkspaceState = { username: undefined, selected: null, draft: null, sidebarOpen: false };

function createWorkspaceStore() {
  let state = initialState;
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
      /**
       * Selects a saved configuration. Re-selecting the same one keeps the
       * draft but takes the fresh data (e.g. its visibility after Publish).
       */
      select(configuration: ConfigurationDto) {
        if (state.selected === configuration) return;
        if (state.selected?.id === configuration.id) {
          setState({ selected: configuration });
          return;
        }
        // A new selection also closes the sidebar on small screens, so the
        // map shows after picking (or saving) a configuration.
        setState({ selected: configuration, draft: configuration.config, sidebarOpen: false });
      },
      updateDraft(draft: Configuration) {
        setState({ draft });
      },
      /**
       * Sets the draft's visible columns, in order: used when the user reorders
       * or hides columns in the attribute table itself. No-op if unchanged.
       */
      setColumns(columns: string[]) {
        const { draft } = state;
        if (!draft || draft.tableConfig.columns.join('\n') === columns.join('\n')) return;
        setState({ draft: { ...draft, tableConfig: { ...draft.tableConfig, columns } } });
      },
      /** Discards unsaved edits. */
      resetDraft() {
        if (state.selected) setState({ draft: state.selected.config });
      },
      setSidebarOpen(sidebarOpen: boolean) {
        setState({ sidebarOpen });
      },
    },
  };
}

type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

const WorkspaceContext = createContext<WorkspaceStore | null>(null);
const FieldsContext = createContext<DatasetFieldDto[]>([]);

/**
 * `fields` is the dataset's field list, read once (cached) by the layout and
 * shared with the editors. It's static, so it's context rather than store state.
 */
export function WorkspaceProvider({
  fields,
  children,
}: {
  fields: DatasetFieldDto[];
  children: React.ReactNode;
}) {
  const [store] = useState(createWorkspaceStore);
  return (
    <WorkspaceContext value={store}>
      <FieldsContext value={fields}>{children}</FieldsContext>
    </WorkspaceContext>
  );
}

/** The dataset's fields, in the layer's order. */
export function useDatasetFields(): DatasetFieldDto[] {
  return use(FieldsContext);
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
 *
 * Hydration reads the initial state, like the server render did, even if the
 * store has moved on (the username can arrive before a page hydrates); React
 * then re-renders with the current state. That keeps the HTML and the first
 * client render identical.
 */
export function useWorkspace<T>(selector: (state: WorkspaceState) => T): T {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(initialState),
  );
}

export function useWorkspaceActions() {
  return useStore().actions;
}

/**
 * True when the draft differs from the saved configuration. Compared by value,
 * so undoing an edit by hand clears it. The objects are small, so stringifying
 * them is cheap.
 */
export function useIsDirty(): boolean {
  return useWorkspace(
    (state) =>
      state.selected !== null &&
      state.draft !== state.selected.config &&
      JSON.stringify(state.draft) !== JSON.stringify(state.selected.config),
  );
}

'use client';

import { PanelLeftIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspace, useWorkspaceActions } from './workspace-store';

/**
 * The sidebar. From `md` up it's a fixed column; on small screens it slides in
 * over the map. It's the same element either way (no duplicated content), and
 * it closes when a configuration is selected. (It doesn't watch the pathname:
 * that's URL data, and reading it here would keep the layout out of the
 * static shell.)
 */
export function Sidebar({ children }: { children: React.ReactNode }) {
  const open = useWorkspace((state) => state.sidebarOpen);
  const { setSidebarOpen } = useWorkspaceActions();

  return (
    <>
      {open && (
        <div aria-hidden className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        id="sidebar"
        aria-label="Configuration"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[min(90vw,22.5rem)] flex-col overflow-y-auto bg-background shadow-lg transition-transform',
          'md:static md:z-auto md:w-90 md:shrink-0 md:translate-x-0 md:border-r md:shadow-none md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex justify-end p-2 pb-0 md:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={() => setSidebarOpen(false)}>
            <XIcon />
          </Button>
        </div>
        {children}
      </aside>
    </>
  );
}

/** Opens the sidebar on small screens. */
export function SidebarToggle() {
  const open = useWorkspace((state) => state.sidebarOpen);
  const { setSidebarOpen } = useWorkspaceActions();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="md:hidden"
      aria-label="Open configuration panel"
      aria-controls="sidebar"
      aria-expanded={open}
      onClick={() => setSidebarOpen(true)}
    >
      <PanelLeftIcon />
    </Button>
  );
}

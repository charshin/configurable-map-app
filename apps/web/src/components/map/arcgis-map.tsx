'use client';

import '@arcgis/core/assets/esri/themes/light/main.css';
import '@arcgis/map-components/components/arcgis-feature-table';
import '@arcgis/map-components/components/arcgis-legend';
import '@arcgis/map-components/components/arcgis-map';
import type { DatasetDto } from '@confmap/shared';
import { watch } from '@arcgis/core/core/reactiveUtils.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type { ArcgisMapCustomEvent } from '@arcgis/map-components';
import { configurationSchema } from '@confmap/shared';
import { ChevronDownIcon, ListIcon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { applyConfiguration, visibleFieldColumns } from '@/lib/configuration/apply';
import { useWorkspace, useWorkspaceActions } from '@/components/workspace/workspace-store';

/**
 * The ArcGIS map, legend and attribute table. Browser-only (loaded with
 * `ssr: false` by MapPanel) and mounted once in the workspace layout, so
 * switching configurations re-styles the existing layer instead of rebuilding
 * the map.
 */
export default function ArcgisMap({ dataset }: { dataset: DatasetDto }) {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const [table, setTable] = useState<HTMLArcgisFeatureTableElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Starts open on wide screens, collapsed on small ones where it would cover
  // much of the map. (This component only renders in the browser.)
  const [legendOpen, setLegendOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  // Deferred so typing in the editors stays responsive while the map restyles.
  const draft = useDeferredValue(useWorkspace((state) => state.draft));
  const { setColumns } = useWorkspaceActions();

  const handleViewReady = useCallback(
    (event: ArcgisMapCustomEvent<void>) => {
      const view = event.target.view;
      if (!view?.map || view.map.layers.length > 0) return;

      const featureLayer = new FeatureLayer({
        url: dataset.layerUrl,
        outFields: ['*'],
        popupTemplate: {
          title: dataset.popupTemplate.title,
          content: [{ type: 'fields', fieldInfos: dataset.popupTemplate.fieldInfos }],
        },
        // Hidden until the first configuration is applied, so the points don't
        // flash in the layer's own style first.
        visible: false,
      });
      view.map.add(featureLayer);
      featureLayer.when(
        () => {
          if (featureLayer.fullExtent) view.goTo(featureLayer.fullExtent).catch(() => {});
          setLayer(featureLayer);
        },
        () => setLoadError(true),
      );
    },
    [dataset],
  );

  useEffect(() => {
    // A draft that's mid-edit and invalid (say, stops out of order) keeps the
    // last valid style on the map; the editor shows what's wrong.
    if (!layer || !draft || !configurationSchema.safeParse(draft).success) return;
    applyConfiguration(layer, table, draft);
  }, [layer, table, draft]);

  // The other direction: columns reordered (drag and drop) or shown/hidden
  // from the table's own menu go back into the draft, so the Columns editor
  // follows. Uses the table's public `visibleColumns`, watched with ArcGIS's
  // reactiveUtils.
  useEffect(() => {
    if (!table) return;
    const handle = watch(
      () => visibleFieldColumns(table).join('\n'),
      (fields) => {
        if (fields) setColumns(fields.split('\n'));
      },
    );
    return () => handle.remove();
  }, [table, setColumns]);

  return (
    <div className="relative flex size-full flex-col">
      {loadError && (
        <Alert variant="destructive" className="absolute top-4 left-1/2 z-10 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2">
          <TriangleAlertIcon />
          <AlertTitle>The tree data didn&apos;t load</AlertTitle>
          <AlertDescription>ArcGIS may be unreachable. Check your connection and try again.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RotateCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}
      <arcgis-map
        id="map"
        basemap="topo-vector"
        onarcgisViewReadyChange={handleViewReady}
        className="min-h-0 flex-1"
      >
        {/*
          Our own collapsible panel rather than <arcgis-expand>: that shows its
          content in a Calcite popover in the browser's top layer, which paints
          above everything else, including this app's dialogs.
        */}
        <div slot="bottom-left" className="flex max-w-64 flex-col overflow-hidden rounded-lg border bg-background shadow-md">
          <Button
            variant="ghost"
            size="sm"
            className="justify-between rounded-none"
            aria-expanded={legendOpen}
            aria-controls="map-legend"
            onClick={() => setLegendOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <ListIcon data-icon="inline-start" />
              Legend
            </span>
            <ChevronDownIcon data-icon="inline-end" className={legendOpen ? 'rotate-180' : undefined} />
          </Button>
          <arcgis-legend id="map-legend" hidden={!legendOpen} className="max-h-[40vh] overflow-y-auto border-t" />
        </div>
      </arcgis-map>
      {layer && (
        <arcgis-feature-table
          ref={setTable}
          referenceElement="map"
          layer={layer}
          className="h-[35vh] shrink-0 border-t"
        />
      )}
    </div>
  );
}

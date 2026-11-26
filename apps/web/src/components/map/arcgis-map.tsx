'use client';

import '@arcgis/core/assets/esri/themes/light/main.css';
import '@arcgis/map-components/components/arcgis-expand';
import '@arcgis/map-components/components/arcgis-feature-table';
import '@arcgis/map-components/components/arcgis-legend';
import '@arcgis/map-components/components/arcgis-map';
import type { DatasetDto } from '@confmap/shared';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type { ArcgisMapCustomEvent } from '@arcgis/map-components';
import { useCallback, useEffect, useState } from 'react';
import { applyConfiguration } from '@/lib/configuration/apply';
import { useWorkspace } from '@/components/workspace/workspace-store';

/**
 * The ArcGIS map, legend and attribute table. Browser-only (loaded with
 * `ssr: false` by MapPanel) and mounted once in the workspace layout, so
 * switching configurations re-styles the existing layer instead of rebuilding
 * the map.
 */
export default function ArcgisMap({ dataset }: { dataset: DatasetDto }) {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const [table, setTable] = useState<HTMLArcgisFeatureTableElement | null>(null);
  const draft = useWorkspace((state) => state.draft);

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
      void featureLayer.when(() => {
        if (featureLayer.fullExtent) view.goTo(featureLayer.fullExtent).catch(() => {});
        setLayer(featureLayer);
      });
    },
    [dataset],
  );

  useEffect(() => {
    if (!layer || !draft) return;
    applyConfiguration(layer, table, draft);
  }, [layer, table, draft]);

  return (
    <div className="flex size-full flex-col">
      <arcgis-map
        id="map"
        basemap="topo-vector"
        onarcgisViewReadyChange={handleViewReady}
        className="min-h-0 flex-1"
      >
        <arcgis-expand slot="bottom-left" expanded>
          <arcgis-legend />
        </arcgis-expand>
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

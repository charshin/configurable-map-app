import type { Configuration } from '@confmap/shared';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js';
import type { ColorVariableProperties } from '@arcgis/core/renderers/visualVariables/ColorVariable.js';
import type { SizeVariableProperties } from '@arcgis/core/renderers/visualVariables/SizeVariable.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import FieldColumnTemplate from '@arcgis/core/widgets/FeatureTable/support/FieldColumnTemplate.js';
import TableTemplate from '@arcgis/core/widgets/FeatureTable/support/TableTemplate.js';

type VisualVariable =
  | (SizeVariableProperties & { type: 'size' })
  | (ColorVariableProperties & { type: 'color' });

/**
 * Applies a configuration to the map layer and the attribute table, and shows
 * the layer.
 *
 * Ported from the starter's `configure()`, with two changes:
 * - A SimpleRenderer instead of a UniqueValueRenderer with no unique values:
 *   every point gets the default symbol either way, and the visual variables
 *   do the real work, so the simpler renderer says what it does.
 * - It's called from an effect when the draft changes, not from a ref callback
 *   that ran on every render.
 */
export function applyConfiguration(
  layer: FeatureLayer,
  table: HTMLArcgisFeatureTableElement | null,
  config: Configuration,
): void {
  const { color, size } = config.symbolConfig;
  const visualVariables: VisualVariable[] = [];
  if (size) visualVariables.push({ type: 'size', field: size.field, stops: size.stops });
  if (color) visualVariables.push({ type: 'color', field: color.field, stops: color.stops });

  layer.renderer = new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      color: '#2f7d4f',
      size: 6,
      outline: { color: [28, 50, 38, 0.6], width: 0.5 },
    }),
    visualVariables,
  });
  // The layer starts hidden so it never shows in its default style.
  layer.visible = true;

  // Columns appear in the configured order; fields not listed are hidden.
  // Skipped when the table already shows exactly that (for example right after
  // the user reordered columns in the table), so the table keeps its column
  // widths and sorting instead of being rebuilt.
  if (table && visibleFieldColumns(table).join('\n') !== config.tableConfig.columns.join('\n')) {
    table.tableTemplate = new TableTemplate({
      columnTemplates: config.tableConfig.columns.map(
        (fieldName) => new FieldColumnTemplate({ fieldName, visible: true }),
      ),
    });
  }
}

/** The table's visible field columns, in display order, as field names. */
export function visibleFieldColumns(table: HTMLArcgisFeatureTableElement): string[] {
  return (table.visibleColumns ?? []).flatMap((column) =>
    'fieldName' in column && typeof column.fieldName === 'string' ? [column.fieldName] : [],
  );
}

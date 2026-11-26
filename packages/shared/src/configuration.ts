import { z } from 'zod';

/**
 * Version of the `Configuration` JSON shape. Stored next to each saved
 * configuration so the shape can evolve: a future v2 adds a migration from
 * v1 instead of breaking configurations that were already saved.
 */
export const CONFIGURATION_SCHEMA_VERSION = 1;

export const MAX_STOPS = 8;
export const MIN_SYMBOL_SIZE = 1;
export const MAX_SYMBOL_SIZE = 64;

const fieldNameSchema = z.string().trim().min(1, 'Field is required').max(64);

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a 6-digit hex code like #00a83a');

/** Stop values must strictly increase so the renderer can interpolate between them. */
function stopsSchema<T extends z.ZodType<{ value: number }>>(stop: T) {
  return z
    .array(stop)
    .min(2, 'Add at least 2 stops')
    .max(MAX_STOPS, `Use at most ${MAX_STOPS} stops`)
    .superRefine((stops, ctx) => {
      for (let i = 1; i < stops.length; i++) {
        if (stops[i].value <= stops[i - 1].value) {
          ctx.addIssue({
            code: 'custom',
            message: 'Values must increase',
            path: [i, 'value'],
          });
        }
      }
    });
}

export const colorStopSchema = z.object({
  value: z.number(),
  color: hexColorSchema,
});

export const sizeStopSchema = z.object({
  value: z.number(),
  size: z.number().min(MIN_SYMBOL_SIZE).max(MAX_SYMBOL_SIZE),
});

export const colorVariableSchema = z.object({
  field: fieldNameSchema,
  stops: stopsSchema(colorStopSchema),
});

export const sizeVariableSchema = z.object({
  field: fieldNameSchema,
  stops: stopsSchema(sizeStopSchema),
});

/**
 * How the dataset is displayed. This is the schema provided by the starter
 * app, with validation added. Extension point: new visual variables (opacity,
 * rotation) or a categorical colour mode would be added here as optional keys.
 */
export const configurationSchema = z.object({
  /**
   * Colour, size or both: at least one, so points always show some data. When
   * both are on they use different fields; one field shown twice adds nothing.
   */
  symbolConfig: z
    .object({
      size: sizeVariableSchema.optional(),
      color: colorVariableSchema.optional(),
    })
    .refine((symbol) => symbol.size !== undefined || symbol.color !== undefined, {
      message: 'Turn on colour, size or both',
    })
    .superRefine(({ color, size }, ctx) => {
      if (!color || !size || color.field !== size.field) return;
      // Reported on both fields, so each editor section can flag its own.
      ctx.addIssue({ code: 'custom', message: 'Already used for size', path: ['color', 'field'] });
      ctx.addIssue({ code: 'custom', message: 'Already used for colour', path: ['size', 'field'] });
    }),
  tableConfig: z.object({
    /** Visible columns, in display order. Fields not listed are hidden. */
    columns: z
      .array(fieldNameSchema)
      .min(1, 'Show at least one column')
      .refine((columns) => new Set(columns).size === columns.length, 'Columns must be unique'),
  }),
}).meta({ id: 'ConfigurationSettings' });

export type ColorStop = z.infer<typeof colorStopSchema>;
export type SizeStop = z.infer<typeof sizeStopSchema>;
export type Configuration = z.infer<typeof configurationSchema>;

export const configurationNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'Use at most 80 characters');

/** Body of `POST /api/datasets/:datasetId/configurations`. */
export const createConfigurationSchema = z
  .object({
    name: configurationNameSchema,
    config: configurationSchema,
    /** Publish immediately instead of saving as private. */
    publish: z.boolean().default(false),
  })
  .meta({ id: 'CreateConfiguration' });

export type CreateConfigurationInput = z.input<typeof createConfigurationSchema>;

/** Every field name a configuration refers to, without duplicates. */
export function referencedFields(config: Configuration): string[] {
  const { size, color } = config.symbolConfig;
  const fields = [
    ...(color ? [color.field] : []),
    ...(size ? [size.field] : []),
    ...config.tableConfig.columns,
  ];
  return [...new Set(fields)];
}

/**
 * Field names the configuration uses that the dataset doesn't have. The
 * schema alone can't check this because it doesn't know the dataset, so the
 * API runs it on save and the editor runs it to show inline warnings.
 */
export function findUnknownFields(config: Configuration, knownFields: Iterable<string>): string[] {
  const known = new Set(knownFields);
  return referencedFields(config).filter((field) => !known.has(field));
}

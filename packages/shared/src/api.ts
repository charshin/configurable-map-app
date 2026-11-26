import { z } from 'zod';
import { configurationSchema } from './configuration.js';

/**
 * Header the web app (BFF) uses to tell the API who the user is.
 *
 * Stand-in for real authentication: the API trusts this value. With SSO, the
 * BFF would forward a signed token instead and an API guard would verify it.
 */
export const USER_ID_HEADER = 'x-user-id';

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(40, 'Use at most 40 characters')
  .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dots, dashes or underscores');

export const configurationKindSchema = z.enum(['SYSTEM', 'CUSTOM']);
export const visibilitySchema = z.enum(['PRIVATE', 'PUBLISHED']);
export const configurationScopeSchema = z.enum(['default', 'published', 'mine']);

export type ConfigurationKind = z.infer<typeof configurationKindSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type ConfigurationScope = z.infer<typeof configurationScopeSchema>;

// Response shapes. They're zod schemas rather than plain interfaces so the
// API's OpenAPI document is generated from the same definitions the web app
// compiles against. `.meta({ id })` names each one as an OpenAPI component.

export const popupTemplateSchema = z
  .object({
    /** ArcGIS template string, e.g. "{Cmn_Name} (Tree {Tree_ID})". */
    title: z.string(),
    fieldInfos: z.array(z.object({ fieldName: z.string(), label: z.string() })),
  })
  .meta({ id: 'PopupTemplate' });

export const datasetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** Feature layer URL: service URL plus layer index. */
    layerUrl: z.url(),
    popupTemplate: popupTemplateSchema,
  })
  .meta({ id: 'Dataset' });

export const datasetFieldSchema = z
  .object({
    name: z.string(),
    alias: z.string(),
    /** ArcGIS field type without the `esriFieldType` prefix, e.g. "Integer". */
    type: z.string(),
    /** True for numeric types, which can drive colour and size. */
    numeric: z.boolean(),
  })
  .meta({ id: 'DatasetField' });

const summaryShape = {
  id: z.uuid(),
  datasetId: z.string(),
  name: z.string(),
  kind: configurationKindSchema,
  visibility: visibilitySchema,
  isDefault: z.boolean(),
  /** Username of the owner; null for system configurations. */
  ownerId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
};

/** List item: everything except the configuration body. */
export const configurationSummarySchema = z.object(summaryShape).meta({ id: 'ConfigurationSummary' });

export const configurationDtoSchema = z
  .object({
    ...summaryShape,
    schemaVersion: z.int(),
    config: configurationSchema,
    /** True when the caller owns this private configuration. */
    canPublish: z.boolean(),
  })
  .meta({ id: 'Configuration' });

export const apiErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL',
]);

/** The single error shape every API error response uses. */
export const apiErrorBodySchema = z
  .object({
    error: z.object({
      code: apiErrorCodeSchema,
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ApiError' });

export type PopupTemplateDto = z.infer<typeof popupTemplateSchema>;
export type DatasetDto = z.infer<typeof datasetSchema>;
export type DatasetFieldDto = z.infer<typeof datasetFieldSchema>;
export type ConfigurationSummaryDto = z.infer<typeof configurationSummarySchema>;
export type ConfigurationDto = z.infer<typeof configurationDtoSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

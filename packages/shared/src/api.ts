import { z } from 'zod';
import type { Configuration } from './configuration.js';

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

export interface PopupFieldInfo {
  fieldName: string;
  label: string;
}

export interface PopupTemplateDto {
  /** ArcGIS template string, e.g. "{Cmn_Name} (Tree {Tree_ID})". */
  title: string;
  fieldInfos: PopupFieldInfo[];
}

export interface DatasetDto {
  id: string;
  name: string;
  /** Feature layer URL: service URL plus layer index. */
  layerUrl: string;
  popupTemplate: PopupTemplateDto;
}

export interface DatasetFieldDto {
  name: string;
  alias: string;
  /** ArcGIS field type without the `esriFieldType` prefix, e.g. "Integer". */
  type: string;
  /** True for numeric types, which can drive colour and size. */
  numeric: boolean;
}

/** List item: everything except the configuration body. */
export interface ConfigurationSummaryDto {
  id: string;
  datasetId: string;
  name: string;
  kind: ConfigurationKind;
  visibility: Visibility;
  isDefault: boolean;
  /** Username of the owner; null for system configurations. */
  ownerId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface ConfigurationDto extends ConfigurationSummaryDto {
  schemaVersion: number;
  config: Configuration;
  /** True when the caller owns this private configuration. */
  canPublish: boolean;
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL';

/** The single error shape every API error response uses. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

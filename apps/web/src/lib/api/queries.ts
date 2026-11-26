import 'server-only';
import {
  type ConfigurationDto,
  configurationDtoSchema,
  configurationSummarySchema,
  datasetFieldSchema,
  datasetSchema,
} from '@confmap/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { ApiError, apiRequest } from './client';
import { cacheTags } from './tags';

// Cached reads of the API. Each is keyed on its arguments, so anything that
// depends on the user takes the username as an argument (read from the cookie
// by the caller) rather than reading the cookie itself. Every profile used here
// keeps a `stale` time of at least 5 minutes, so the results can be part of the
// prerendered shell and of the prefetched App Shell.

const configurationListSchema = z.array(configurationSummarySchema);

export async function getDataset(datasetId: string) {
  'use cache';
  cacheLife('max');
  cacheTag(cacheTags.dataset(datasetId));
  return apiRequest(`/datasets/${encodeURIComponent(datasetId)}`, datasetSchema);
}

export async function getDatasetFields(datasetId: string) {
  'use cache';
  cacheLife('max');
  cacheTag(cacheTags.dataset(datasetId));
  return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/fields`, z.array(datasetFieldSchema));
}

export async function getDefaultConfiguration(datasetId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.defaultConfiguration(datasetId));
  return apiRequest(`/datasets/${encodeURIComponent(datasetId)}/configurations/default`, configurationDtoSchema);
}

export async function getPublishedConfigurations(datasetId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.publishedConfigurations(datasetId));
  return apiRequest(
    `/datasets/${encodeURIComponent(datasetId)}/configurations?scope=published`,
    configurationListSchema,
  );
}

export async function getOwnedConfigurations(datasetId: string, username: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.ownedConfigurations(username));
  return apiRequest(
    `/datasets/${encodeURIComponent(datasetId)}/configurations?scope=mine`,
    configurationListSchema,
    { userId: username },
  );
}

/**
 * One configuration, or null when it's missing or private to someone else.
 * Saved configurations never change (only their visibility), hence `max`.
 * When `username` is passed, the entry is cached for that user only, so a
 * private configuration never lands in a cache entry another user could read.
 */
export async function getConfiguration(id: string, username?: string): Promise<ConfigurationDto | null> {
  'use cache';
  cacheLife('max');
  cacheTag(cacheTags.configuration(id));
  try {
    return await apiRequest(`/configurations/${encodeURIComponent(id)}`, configurationDtoSchema, {
      userId: username,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

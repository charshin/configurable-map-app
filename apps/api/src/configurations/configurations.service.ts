import {
  CONFIGURATION_SCHEMA_VERSION,
  type ConfigurationDto,
  type ConfigurationScope,
  type ConfigurationSummaryDto,
  configurationSchema,
  type CreateConfigurationInput,
  findUnknownFields,
} from '@confmap/shared';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api.exception.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import { type ConfigurationRow, ConfigurationsRepository } from './configurations.repository.js';

type CreateInput = Required<CreateConfigurationInput>;

/**
 * Rules for reading, creating and publishing configurations.
 *
 * Visibility: system and published configurations are visible to everyone; a
 * private one only to its owner. To anyone else a private configuration
 * responds exactly like a missing one (404), so ids can't be probed.
 */
@Injectable()
export class ConfigurationsService {
  constructor(
    private readonly repository: ConfigurationsRepository,
    private readonly datasets: DatasetsService,
  ) {}

  async list(
    datasetId: string,
    scope: ConfigurationScope,
    userId: string | undefined,
  ): Promise<ConfigurationSummaryDto[]> {
    await this.datasets.findById(datasetId);
    switch (scope) {
      case 'default': {
        const row = await this.repository.findDefault(datasetId);
        return row ? [toSummary(row)] : [];
      }
      case 'published':
        return (await this.repository.listPublished(datasetId)).map(toSummary);
      case 'mine':
        if (!userId) throw ApiException.unauthenticated('Listing your configurations needs the X-User-Id header');
        return (await this.repository.listByOwner(datasetId, userId)).map(toSummary);
    }
  }

  async getDefault(datasetId: string, userId: string | undefined): Promise<ConfigurationDto> {
    await this.datasets.findById(datasetId);
    const row = await this.repository.findDefault(datasetId);
    if (!row) throw ApiException.notFound(`Dataset "${datasetId}" has no default configuration`);
    return toDto(row, userId);
  }

  async get(id: string, userId: string | undefined): Promise<ConfigurationDto> {
    const row = await this.repository.findById(id);
    if (!row || !isVisibleTo(row, userId)) throw ApiException.notFound('Configuration not found');
    return toDto(row, userId);
  }

  async create(datasetId: string, input: CreateInput, userId: string): Promise<ConfigurationDto> {
    // Also responds 404 when the dataset doesn't exist.
    const fields = await this.datasets.getFields(datasetId);
    assertFieldsExist(input.config, fields);

    const now = new Date();
    const row = await this.repository.create({
      datasetId,
      name: input.name,
      ownerId: userId,
      kind: 'CUSTOM',
      visibility: input.publish ? 'PUBLISHED' : 'PRIVATE',
      publishedAt: input.publish ? now : null,
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
      config: input.config,
      createdAt: now,
    });
    return toDto(row, userId);
  }

  /** Publishes the caller's private configuration. Publishing it again is a no-op. */
  async publish(id: string, userId: string): Promise<ConfigurationDto> {
    const row = await this.repository.findById(id);
    if (!row || !isVisibleTo(row, userId)) throw ApiException.notFound('Configuration not found');
    if (row.ownerId !== userId) throw ApiException.forbidden('Only the owner can publish this configuration');
    if (row.visibility === 'PUBLISHED') return toDto(row, userId);

    await this.repository.publish(id, userId, new Date());
    // Re-read either way: if a concurrent request published it first, it's still published.
    const published = await this.repository.findById(id);
    if (!published) throw ApiException.notFound('Configuration not found');
    return toDto(published, userId);
  }
}

function isVisibleTo(row: ConfigurationRow, userId: string | undefined): boolean {
  return row.visibility === 'PUBLISHED' || row.ownerId === userId;
}

function assertFieldsExist(
  config: CreateInput['config'],
  fields: { name: string; numeric: boolean }[],
): void {
  const unknownFields = findUnknownFields(
    config,
    fields.map((field) => field.name),
  );
  if (unknownFields.length > 0) {
    throw ApiException.validation('The configuration uses fields this dataset does not have', {
      unknownFields,
    });
  }
  const numeric = new Set(fields.filter((field) => field.numeric).map((field) => field.name));
  const nonNumeric = [config.symbolConfig.color?.field, config.symbolConfig.size?.field].filter(
    (field): field is string => field !== undefined && !numeric.has(field),
  );
  if (nonNumeric.length > 0) {
    throw ApiException.validation('Colour and size need numeric fields', { nonNumericFields: nonNumeric });
  }
}

function toSummary(row: ConfigurationRow): ConfigurationSummaryDto {
  return {
    id: row.id,
    datasetId: row.datasetId,
    name: row.name,
    kind: row.kind,
    visibility: row.visibility,
    isDefault: row.isDefault,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toDto(row: ConfigurationRow, userId: string | undefined): ConfigurationDto {
  // Extension point: when CONFIGURATION_SCHEMA_VERSION moves past 1, migrate
  // older `row.config` shapes here, keyed on row.schemaVersion.
  return {
    ...toSummary(row),
    schemaVersion: row.schemaVersion,
    config: configurationSchema.parse(row.config),
    canPublish: row.visibility === 'PRIVATE' && row.ownerId !== null && row.ownerId === userId,
  };
}

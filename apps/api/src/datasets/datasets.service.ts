import { type DatasetDto, type DatasetFieldDto, popupTemplateSchema } from '@confmap/shared';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArcgisLayerClient } from './arcgis-layer.client.js';

@Injectable()
export class DatasetsService {
  /**
   * Field lists by dataset id. A layer's schema changes rarely, so it's kept for
   * the life of the process; in-flight requests are shared too. Extension point:
   * a TTL, or a refresh endpoint, if layers start changing at runtime.
   */
  private readonly fieldsCache = new Map<string, Promise<DatasetFieldDto[]>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly arcgis: ArcgisLayerClient,
  ) {}

  async findById(id: string): Promise<DatasetDto> {
    const dataset = await this.prisma.dataset.findUnique({ where: { id } });
    if (!dataset) throw ApiException.notFound(`Dataset "${id}" not found`);
    return {
      id: dataset.id,
      name: dataset.name,
      layerUrl: dataset.layerUrl,
      popupTemplate: popupTemplateSchema.parse(dataset.popupTemplate),
    };
  }

  async getFields(id: string): Promise<DatasetFieldDto[]> {
    const cached = this.fieldsCache.get(id);
    if (cached) return cached;

    const pending = this.findById(id).then((dataset) => this.arcgis.fetchFields(dataset.layerUrl));
    this.fieldsCache.set(id, pending);
    // Don't keep failures: the next request retries.
    pending.catch(() => this.fieldsCache.delete(id));
    return pending;
  }
}

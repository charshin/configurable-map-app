import type { DatasetFieldDto } from '@confmap/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ApiException } from '../common/api.exception.js';

const NUMERIC_TYPES = new Set(['SmallInteger', 'Integer', 'BigInteger', 'Single', 'Double']);

const layerMetadataSchema = z.object({
  fields: z.array(z.object({ name: z.string(), alias: z.string().nullish(), type: z.string() })),
});

/**
 * Reads a feature layer's field list from the ArcGIS REST API
 * (`<layerUrl>?f=json`). Its own provider so tests can replace it and run
 * without network access.
 */
@Injectable()
export class ArcgisLayerClient {
  async fetchFields(layerUrl: string): Promise<DatasetFieldDto[]> {
    const url = new URL(layerUrl);
    url.searchParams.set('f', 'json');

    let body: unknown;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      body = await response.json();
    } catch (error) {
      throw this.unavailable(error);
    }
    // ArcGIS reports some errors as HTTP 200 with an `error` object, which fails this parse too.
    const result = layerMetadataSchema.safeParse(body);
    if (!result.success) throw this.unavailable(result.error);

    return result.data.fields.map((field) => {
      const type = field.type.replace(/^esriFieldType/, '');
      return { name: field.name, alias: field.alias || field.name, type, numeric: NUMERIC_TYPES.has(type) };
    });
  }

  private unavailable(cause: unknown) {
    return new ApiException(
      HttpStatus.BAD_GATEWAY,
      'UPSTREAM_UNAVAILABLE',
      'Could not read the layer metadata from ArcGIS',
      { cause: cause instanceof Error ? cause.message : String(cause) },
    );
  }
}

import { apiErrorBodySchema, datasetFieldSchema, datasetSchema } from '@confmap/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { DatasetsService } from './datasets.service.js';

@ApiTags('Datasets')
@ApiNotFoundResponse({ description: 'Dataset not found', standardSchema: apiErrorBodySchema })
@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  /** A dataset: its name, feature layer URL and popup template. */
  @Get(':datasetId')
  @ApiOkResponse({ standardSchema: datasetSchema })
  findOne(@Param('datasetId') datasetId: string) {
    return this.datasets.findById(datasetId);
  }

  /** The dataset's fields, read from the feature layer's metadata. */
  @Get(':datasetId/fields')
  @ApiOkResponse({ standardSchema: z.array(datasetFieldSchema) })
  @ApiBadGatewayResponse({ description: 'ArcGIS unavailable', standardSchema: apiErrorBodySchema })
  fields(@Param('datasetId') datasetId: string) {
    return this.datasets.getFields(datasetId);
  }
}

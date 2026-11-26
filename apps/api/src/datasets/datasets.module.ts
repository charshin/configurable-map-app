import { Module } from '@nestjs/common';
import { ArcgisLayerClient } from './arcgis-layer.client.js';
import { DatasetsController } from './datasets.controller.js';
import { DatasetsService } from './datasets.service.js';

@Module({
  controllers: [DatasetsController],
  providers: [DatasetsService, ArcgisLayerClient],
  exports: [DatasetsService],
})
export class DatasetsModule {}

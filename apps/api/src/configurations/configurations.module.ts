import { Module } from '@nestjs/common';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { ConfigurationsController } from './configurations.controller.js';
import { ConfigurationsRepository } from './configurations.repository.js';
import { ConfigurationsService } from './configurations.service.js';

@Module({
  imports: [DatasetsModule],
  controllers: [ConfigurationsController],
  providers: [ConfigurationsService, ConfigurationsRepository],
})
export class ConfigurationsModule {}

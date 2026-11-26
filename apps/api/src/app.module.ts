import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { ConfigurationsModule } from './configurations/configurations.module.js';
import { DatasetsModule } from './datasets/datasets.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    DatasetsModule,
    ConfigurationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

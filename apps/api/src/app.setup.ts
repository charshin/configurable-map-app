import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { createValidationPipe } from './common/validation.js';

export const API_PREFIX = 'api';

/** Prefix, validation and error format. Shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}

/** OpenAPI document at /api/docs (UI) and /api/docs-json (JSON). */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Configurable Map API')
    .setDescription(
      'Saved display configurations for map datasets: symbology (point colour and size) and attribute table columns. ' +
        'Errors always use the ApiError shape. The X-User-Id header identifies the caller; it is a stand-in for real authentication.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
}

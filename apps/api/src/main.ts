import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp, setupOpenApi } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  setupOpenApi(app);
  app.enableShutdownHooks();
  // 4000 by default so it doesn't clash with the web app on 3000.
  await app.listen(app.get(ConfigService<Env, true>).get('PORT', { infer: true }));
}
await bootstrap();

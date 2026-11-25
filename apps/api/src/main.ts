import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const API_PREFIX = 'api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  // 4000 so it doesn't clash with the web app on 3000.
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();

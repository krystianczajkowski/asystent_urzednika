import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:4200').split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

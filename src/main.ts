import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('bootstrap');
  const config = app.get(ConfigService<Env, true>);

  app.use(
    helmet({
      contentSecurityPolicy:
        config.get('NODE_ENV', { infer: true }) === 'production',
    }),
  );

  const allowed = config
    .get('ALLOWED_ORIGINS', { infer: true })
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowed.length > 0 ? allowed : false,
    credentials: false,
  });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestAI Starter')
    .setDescription(
      'Production-grade NestJS + Postgres + Drizzle + JWT + Groq AI starter.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'User registration, login, and identity')
    .addTag('ai', 'LLM-backed generation endpoints')
    .addTag('health', 'Liveness probe')
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`NestAI Starter listening on http://localhost:${port}`);
  logger.log(`Swagger UI:      http://localhost:${port}/docs`);
}

void bootstrap();

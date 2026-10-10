import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { pinoHttp } from 'pino-http';

import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv(); // fails fast on bad config, before the app starts accepting traffic

  const app = await NestFactory.create(AppModule);
  app.use(pinoHttp());
  // Open for now so apps/web can call it from any dev port; scope this to the
  // real web origin(s) before production.
  app.enableCors();

  // Dev/test only — not something a production deployment should expose publicly.
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Akaunta API')
      .setDescription('Welfare/SACCO group ledger, loans, and membership API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(env.PORT);
}

bootstrap();

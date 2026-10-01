import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './config/app.setup.js';
import { loadEnv } from './config/env.schema.js';
import { OPENAPI_JSON_PATH } from './config/openapi.config.js';
import { SCALAR_REFERENCE_PATH } from './config/scalar.config.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env);
  // SIGTERM/SIGINT → onApplicationShutdown (cierra conexiones y el almacén clave-valor).
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  const logger = new Logger('Bootstrap');
  logger.log(`BFF en http://localhost:${env.PORT}/api`);
  if (env.API_DOCS_ENABLED ?? env.NODE_ENV !== 'production') {
    logger.log(`Scalar UI en http://localhost:${env.PORT}${SCALAR_REFERENCE_PATH}`);
    logger.log(`OpenAPI JSON en http://localhost:${env.PORT}${OPENAPI_JSON_PATH}`);
  }
}
await bootstrap();

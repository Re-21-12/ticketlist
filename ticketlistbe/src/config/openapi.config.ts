import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { setupScalar } from './scalar.config.js';

/** JSON de OpenAPI crudo (para generadores de clientes, Postman, CI). La UI es Scalar. */
export const OPENAPI_JSON_PATH = '/api/openapi.json';

/**
 * Genera el documento OpenAPI (desde los schemas Zod, ver `core/decorators/api-zod.decorator.ts`)
 * y lo publica con Scalar UI en `/api/reference`. No se monta Swagger UI: una sola UI de referencia.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Ticketit BFF')
    .setDescription(
      [
        'Recursos (`/api/tickets`) + endpoints por pantalla (`/api/bff/*`).',
        '',
        '**Sesión mock:** header `x-mock-role` (`ADMIN` | `AGENT` | `VIEWER`).',
        '',
        '**Errores:** todos con el mismo cuerpo (`statusCode`, `error`, `errorCode`, `detail`, `issues`).',
        'Formato del código `<Capa><Módulo>-E<###>` — catálogo completo en `docs/standard/error-catalog.md`.',
      ].join('\n'),
    )
    .setVersion('0.0.1')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-mock-role' }, 'mock-role')
    .addSecurityRequirements('mock-role')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupApiDocs(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  app.getHttpAdapter().get(OPENAPI_JSON_PATH, (_req: unknown, res: { json: (body: unknown) => void }) =>
    res.json(document),
  );
  setupScalar(app, document);
}

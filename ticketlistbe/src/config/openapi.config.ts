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
        'Recursos (`/api/tickets`, `/api/users`…) + endpoints por pantalla (`/api/bff/*`).',
        '',
        '**Sesión:** `POST /api/auth/sign-in` deja la cookie `sid` (HttpOnly) y la cookie `XSRF-TOKEN`. Las peticiones que modifican (`POST`, `PATCH`, `PUT`, `DELETE`) deben enviar el encabezado `X-XSRF-TOKEN` con el mismo valor que esa cookie (si no: 403 `SAUT-E003`).',
        '',
        '**Errores:** todos con el mismo cuerpo RFC 9457 (`type`, `title`, `status`, `code`, `errors`…), sin detalles internos del servidor.',
        'Formato del código `<Capa><Módulo>-E<###>` — catálogo completo en `docs/standard/error-catalog.md` y en `GET /api/problems`.',
      ].join('\n'),
    )
    .setVersion('0.0.1')
    .addCookieAuth('sid', undefined, 'session')
    .addSecurityRequirements('session')
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

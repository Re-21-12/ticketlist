import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

/** Referencia interactiva de la API (Scalar UI), mismo patrón que wallet-api (`scalar.config.ts`). */
export const SCALAR_REFERENCE_PATH = '/api/reference';

export function setupScalar(app: INestApplication, document: OpenAPIObject): void {
  app.use(
    SCALAR_REFERENCE_PATH,
    apiReference({
      content: document,
      pageTitle: 'Ticketit BFF — Reference',
      theme: 'purple',
    }),
  );
}

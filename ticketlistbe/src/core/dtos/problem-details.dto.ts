import * as z from 'zod';

/** Media type de RFC 9457 §3 — TODA respuesta de error lo usa. */
export const PROBLEM_JSON = 'application/problem+json';

/** Base de `type`: `/api/problems/<código>` es desreferenciable (ver ProblemsController). */
export const PROBLEM_TYPE_BASE = '/api/problems/';

/**
 * Problem Details for HTTP APIs — RFC 9457 (reemplaza al cuerpo propio de wallet-api, que nunca
 * migró: issue #178 allá). Miembros estándar (§3.1) + extensiones (§3.2).
 *
 * - `type`     URI del tipo de problema → `/api/problems/<code>` (relativa, se resuelve contra la
 *              request; devuelve la entrada del catálogo). NUNCA cambia entre ocurrencias.
 * - `title`    resumen legible del TIPO — estable por código (no depende de la ocurrencia).
 * - `status`   el mismo status HTTP de la respuesta (advisory, §3.1.2).
 * - `detail`   explicación de ESTA ocurrencia (p. ej. el mensaje de Nest o el contexto).
 * - `instance` la URI de la request que falló.
 * Extensiones: `code` (catálogo `<Capa><Módulo>-E###`), `timestamp`, `context`, `errors`.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string(),
  code: z.string(),
  timestamp: z.iso.datetime(),
  context: z.record(z.string(), z.unknown()).nullable(),
  /** Solo en 400 `CVAL-E001`: un elemento por campo inválido. */
  errors: z
    .array(
      z.object({
        /** JSON Pointer (RFC 6901) al campo en el body: `#/title`, `#/items/0/name`. */
        pointer: z.string(),
        /** Ruta en notación de puntos (`title`) = key del campo del formulario del front. */
        path: z.string(),
        /** Mensaje de `VALIDATION_ERRORS` ya interpolado (español). */
        message: z.string(),
        /** Código del issue de Zod (`too_small`, `invalid_type`, `custom`…). */
        code: z.string(),
      }),
    )
    .optional(),
});

export type TProblemDetails = z.output<typeof ProblemDetailsSchema>;

/** Segmentos de ruta → JSON Pointer (RFC 6901: `~` → `~0`, `/` → `~1`). */
export function toJsonPointer(path: readonly PropertyKey[]): string {
  return `#/${path.map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

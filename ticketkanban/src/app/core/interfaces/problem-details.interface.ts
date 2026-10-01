import { HttpErrorResponse } from '@angular/common/http';

/** Un campo inválido de un 400 `CVAL-E001`. `path` = `key` del campo del formulario dinámico. */
export interface IProblemFieldError {
  /** JSON Pointer (RFC 6901) al campo: `#/title`. */
  pointer: string;
  path: string;
  message: string;
  code: string;
}

/**
 * Cuerpo de error de ticketlistbe: RFC 9457 Problem Details (`application/problem+json`) más las
 * extensiones del catálogo. Contrato: ticketlistbe/docs/standard/error-catalog.md §2.
 */
export interface IProblemDetails {
  /** `/api/problems/<code>`: desreferenciable, devuelve la entrada del catálogo. */
  type: string;
  /** Resumen del TIPO de problema (estable), en el idioma de `Accept-Language`. */
  title: string;
  status: number;
  /** Explicación de ESTA ocurrencia (p. ej. «2 campo(s) inválido(s)»). */
  detail?: string;
  instance: string;
  /** Código del catálogo `<Capa><Módulo>-E###`. */
  code: string;
  timestamp: string;
  context: Record<string, unknown> | null;
  errors?: IProblemFieldError[];
}

/** Problem Details de un error HTTP, o `null` si el cuerpo no lo es (red caída, proxy, etc.). */
export function readProblem(error: unknown): IProblemDetails | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = error.error as Partial<IProblemDetails> | null;
  return body && typeof body === 'object' && typeof body.code === 'string' && typeof body.title === 'string'
    ? (body as IProblemDetails)
    : null;
}

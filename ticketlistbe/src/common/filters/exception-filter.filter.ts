import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '../codes/error-codes.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import type { IErrorDetail } from '../../core/interfaces/Icustom-code.interface.js';
import {
  PROBLEM_JSON,
  PROBLEM_TYPE_BASE,
  toJsonPointer,
  type TProblemDetails,
} from '../../core/dtos/problem-details.dto.js';

type TDbError = Error & { driverError?: { code?: string } };

/**
 * Título de los errores del framework (`NEST-E<status>`) en lenguaje de negocio. NUNCA se usa `exception.name`
 * («NotFoundException», «BadRequestException»…) ni su mensaje («Cannot GET /api/…»): delatan el framework y su
 * enrutamiento (hallazgo D-04, seguridad: mensajes internos en producción).
 */
const NEST_TITLES: Record<number, { es: string; en: string }> = {
  400: { es: 'La solicitud no es válida', en: 'The request is not valid' },
  401: { es: 'Necesitas iniciar sesión', en: 'You need to sign in' },
  403: { es: 'No tienes permiso para hacer esto', en: 'You do not have permission to do this' },
  404: { es: 'No encontramos lo que buscas', en: 'We could not find what you are looking for' },
  405: { es: 'Esa acción no está disponible', en: 'That action is not available' },
  406: { es: 'No podemos responder en ese formato', en: 'We cannot answer in that format' },
  408: { es: 'La solicitud tardó demasiado', en: 'The request took too long' },
  409: { es: 'La acción choca con el estado actual', en: 'The action conflicts with the current state' },
  413: { es: 'El contenido enviado es demasiado grande', en: 'The content sent is too large' },
  415: { es: 'Ese tipo de contenido no se admite', en: 'That content type is not supported' },
  422: { es: 'No pudimos procesar los datos enviados', en: 'We could not process the data sent' },
  429: { es: 'Demasiados intentos. Espera un momento', en: 'Too many attempts. Wait a moment' },
};
const NEST_FALLBACK = { es: 'No se pudo completar la solicitud', en: 'The request could not be completed' };
const DB_CODES: Record<string, IErrorDetail> = ERROR_CODES.DB;

interface IResolved {
  detail: IErrorDetail;
  /** Explicación de ESTA ocurrencia (RFC 9457 §3.1.4); si falta, se omite `detail`. */
  occurrence?: string;
  context: Record<string, unknown> | null;
  errors?: TProblemDetails['errors'];
}

/**
 * Filtro global — el ÚNICO lugar que traduce una excepción a status + cuerpo. Responde SIEMPRE
 * `application/problem+json` (RFC 9457). Orden de resolución (docs/standard/error-catalog.md §2):
 *   1. `ZodError`                  → 400 `CVAL-E001` + `errors[{ pointer, path, message, code }]`
 *   2. `CustomBusinessException`   → status y código del catálogo (`ERROR_CODES`)
 *   3. Error de BD (`driverError`) → `ERROR_CODES.DB[SQLSTATE]` si está mapeado
 *   4. `HttpException` de Nest     → su status, código `NEST-E<status>`
 *   5. Cualquier otro              → 500 `SYS-E999`
 * Toda respuesta de error lleva `Cache-Control: no-store` (RFC 9111 §5.2.2.5): un error nunca
 * debe quedar cacheado.
 */
@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isSpanish = (request.headers['accept-language'] ?? 'es').toLowerCase().includes('es');

    const resolved = this.resolve(exception);
    const { detail } = resolved;
    if (detail.httpStatus >= 500) {
      this.logger.error(`${request.method} ${request.originalUrl} ${detail.httpStatus} ${detail.code}`, exception);
    }

    const problem: TProblemDetails = {
      type: `${PROBLEM_TYPE_BASE}${detail.code}`,
      title: isSpanish ? detail.messageEs : detail.messageEn,
      status: detail.httpStatus,
      ...(resolved.occurrence ? { detail: resolved.occurrence } : {}),
      instance: request.originalUrl,
      code: detail.code,
      timestamp: new Date().toISOString(),
      context: resolved.context,
      ...(resolved.errors ? { errors: resolved.errors } : {}),
    };

    // RFC 9110 §10.2.3: cuánto esperar antes de reintentar (429 / 503).
    const retryAfter = resolved.context?.['retryAfterSeconds'];
    if (typeof retryAfter === 'number') response.setHeader('Retry-After', String(retryAfter));
    response.setHeader('Vary', 'Accept-Language');
    response.setHeader('Cache-Control', 'no-store');
    response.status(detail.httpStatus).type(PROBLEM_JSON).send(JSON.stringify(problem));
  }

  private resolve(exception: unknown): IResolved {
    if (exception instanceof ZodError) {
      return {
        detail: ERROR_CODES.VAL.INVALID_PAYLOAD,
        occurrence: `${exception.issues.length} campo(s) inválido(s)`,
        context: null,
        errors: exception.issues.map((issue) => ({
          pointer: toJsonPointer(issue.path),
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      };
    }
    if (exception instanceof CustomBusinessException) {
      return {
        detail: exception.errorDetail,
        context: (exception.context as Record<string, unknown> | undefined) ?? null,
      };
    }
    if (exception instanceof Error && 'driverError' in exception) {
      const dbError = DB_CODES[(exception as TDbError).driverError?.code ?? ''];
      if (dbError) return { detail: dbError, context: null };
    }
    // multer corta una subida que pasa del tope («File too large») → el mismo código que el chequeo propio.
    if (exception instanceof HttpException && exception.getStatus() === 413 && exception.message === 'File too large') {
      return { detail: ERROR_CODES.ATT.TOO_LARGE, context: null };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const title = NEST_TITLES[status] ?? NEST_FALLBACK;
      // Sin `detail`: el mensaje original del framework describe su funcionamiento interno (rutas, clases, validadores).
      return {
        detail: { code: `NEST-E${status}`, httpStatus: status, messageEs: title.es, messageEn: title.en },
        context: null,
      };
    }
    return { detail: ERROR_CODES.SYS.INTERNAL, context: null };
  }
}

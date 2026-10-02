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
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      const message = Array.isArray(raw) ? raw.map(String).join(', ') : typeof raw === 'string' ? raw : undefined;
      return {
        detail: {
          code: `NEST-E${status}`,
          httpStatus: status,
          messageEs: exception.name,
          messageEn: exception.name,
        },
        occurrence: message,
        context: null,
      };
    }
    return { detail: ERROR_CODES.SYS.INTERNAL, context: null };
  }
}

import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { catchError, throwError } from 'rxjs';
import { readProblem } from '../interfaces/problem-details.interface';
import { SessionStore } from '../session/session.store';
import { SUPPRESS_ERROR_TOAST } from './suppress-error-toast.token';

/**
 * Muestra UN toast por error HTTP y SIEMPRE re-lanza el error: el caller (store/httpResource)
 * lo sigue recibiendo para dejar la UI como corresponda (p. ej. el modal abierto). Mismo contrato
 * que `error.interceptor.ts` de wallet-api, pero leyendo RFC 9457 Problem Details.
 *
 * 401 = la sesión se perdió (expiró o se cerró en otra pestaña): se limpia el estado local para
 * que menú, pipes `can` y guards dejen de mostrar lo que ya no se puede hacer.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);
  const sessionStore = inject(SessionStore);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) sessionStore.clear();
        if (!req.context.get(SUPPRESS_ERROR_TOAST)) {
          const problem = readProblem(error);
          messageService.add({
            severity: 'error',
            summary: problem?.title ?? 'Algo salió mal',
            // `detail` de la ocurrencia + código del catálogo (para soporte).
            detail: problem ? [problem.detail, problem.code].filter(Boolean).join(' · ') : undefined,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};

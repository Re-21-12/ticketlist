import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { catchError, throwError } from 'rxjs';
import { readProblem } from '../interfaces/problem-details.interface';
import { safeReturnUrl } from '../routing/safe-return-url.util';
import { SessionStore } from '../session/session.store';
import { SUPPRESS_ERROR_TOAST } from './suppress-error-toast.token';

/**
 * Muestra UN toast por error HTTP y SIEMPRE re-lanza el error: el caller (store/httpResource)
 * lo sigue recibiendo para dejar la UI como corresponda (p. ej. el modal abierto). Mismo contrato
 * que `error.interceptor.ts` de wallet-api, pero leyendo RFC 9457 Problem Details.
 *
 * 401 = la sesión se perdió (expiró por inactividad o se cerró en otra pestaña): se limpia el estado local para
 * que menú, pipes `can` y guards dejen de mostrar lo que ya no se puede hacer. Si la persona SÍ tenía sesión, se le
 * avisa UNA vez en lenguaje llano («Tu sesión terminó») y se la lleva a iniciar sesión recordando dónde estaba; el
 * código `SAUT-E002` no se le muestra (es ruido para quien no es soporte). Sin sesión previa (p. ej. peticiones que
 * llegan tras cerrar sesión) no se avisa de nada.
 */
/** `SAUT-E002`: no hay sesión (o ya no). Las demás 401 (credenciales, contraseña temporal vencida) se muestran como cualquier error. */
const SESSION_LOST_CODE = 'SAUT-E002';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);
  const sessionStore = inject(SessionStore);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const sessionLost = error.status === 401 && readProblem(error)?.code === SESSION_LOST_CODE;
        const wasAuthenticated = sessionStore.$isAuthenticated();
        if (error.status === 401) sessionStore.clear();
        if (sessionLost) {
          if (wasAuthenticated) {
            messageService.add({ severity: 'warn', summary: 'Tu sesión terminó', detail: 'Inicia sesión de nuevo para continuar.' });
            void router.navigate(['/sign-in'], { queryParams: { returnUrl: safeReturnUrl(router.url) } });
          }
        } else if (!req.context.get(SUPPRESS_ERROR_TOAST)) {
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

import type { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';

/**
 * BFF FALSO para desarrollar el front sin `ticketlistbe` (ver `mock-bff.handler.ts`).
 * El handler se importa LAZY: el mock, sus datos y los schemas que usa no entran al bundle
 * inicial. Quitar de `app.config.ts` cuando el backend esté arriba (y apuntar `/api` con proxy).
 */
export const mockBffInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  return from(import('./mock-bff.handler')).pipe(switchMap((m) => m.handleMockBff(req)));
};

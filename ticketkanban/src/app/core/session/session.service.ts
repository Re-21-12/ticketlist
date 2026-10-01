import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { from, map, switchMap, type Observable } from 'rxjs';
import { suppressErrorToast } from '../interceptors/suppress-error-toast.token';
import type { ISignInRequest, TShell } from './session.types';

/**
 * Acceso HTTP de la sesión. Solo transporte + validación Zod de la respuesta; el estado vive en
 * `SessionStore`.
 *
 * La sesión es STATEFUL en ticketlistbe: la identidad viaja en la cookie `sid` (HttpOnly, la
 * maneja el navegador) y las mutaciones llevan `X-XSRF-TOKEN`, que `HttpClient` agrega solo
 * leyendo la cookie `XSRF-TOKEN`. Aquí no se guarda ningún token.
 */
@Service()
export class SessionService {
  private readonly _http = inject(HttpClient);

  /**
   * Shell de la sesión vigente. 401 si no hay sesión: es un caso esperado al arrancar, por eso
   * sin toast (lo maneja `SessionStore`).
   */
  getShell(): Observable<TShell> {
    return this.parseShell(this._http.get<unknown>('/api/bff/shell', { context: suppressErrorToast() }));
  }

  /** Inicia sesión: el backend regenera la sesión, setea las cookies y responde el shell. */
  signIn(credentials: ISignInRequest): Observable<TShell> {
    return this.parseShell(this._http.post<unknown>('/api/auth/sign-in', credentials));
  }

  signOut(): Observable<void> {
    return this._http.post<void>('/api/auth/sign-out', null);
  }

  private parseShell(request$: Observable<unknown>): Observable<TShell> {
    // Schema importado LAZY: la sesión se carga en el arranque (provideAppInitializer) y un
    // import estático metía Zod (~124 kB) en el bundle inicial. Así viaja en el chunk compartido
    // que las páginas igual necesitan.
    return from(import('./session.schema')).pipe(
      switchMap(({ ShellSchema }) => request$.pipe(map((raw) => ShellSchema.parse(raw)))),
    );
  }
}

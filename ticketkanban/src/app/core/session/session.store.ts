import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { SessionService } from './session.service';
import type { TShell } from './session.types';

/**
 * Estado de la sesión: usuario, reglas CASL y menú.
 *
 * Signal escribible PRIVADO (`$_session`) y lecturas públicas derivadas — nadie fuera del store
 * puede pisar la sesión con `.set()` (misma regla que wallet-api).
 *
 * Reglas CASL: patrón "update ability rules" de la doc de @casl/angular — se muta la ÚNICA
 * instancia compartida con `ability.update(rules)`, que dispara el evento `updated` que escucha
 * `AbilityServiceSignal`, y con eso se recalculan menú, pipes `can` y guards. Se hace en el mismo
 * método que setea la sesión, no en un `effect()` (evita propagar estado por efectos).
 */
@Service()
export class SessionStore {
  private readonly _sessionService = inject(SessionService);
  private readonly _ability = inject(AppAbility);
  private readonly _messageService = inject(MessageService);

  private readonly $_session = signal<TShell | null>(null);

  readonly $user = computed(() => this.$_session()?.user ?? null);
  readonly $role = computed(() => this.$_session()?.user.role);
  readonly $menu = computed(() => this.$_session()?.menu ?? []);
  readonly $isAuthenticated = computed(() => this.$_session() !== null);
  /** Hay usuarios de desarrollo: se muestra el selector «Rol de prueba». */
  readonly canSwitchRole = environment.devSignIn !== null;

  /**
   * Arranque: retoma la sesión de la cookie `sid` si sigue viva. Sin sesión (401), en desarrollo
   * inicia sesión como el agente sembrado; en producción queda sin sesión.
   *
   * NUNCA lanza: corre en `provideAppInitializer` y un error ahí deja la app en blanco. Si el BFF
   * no responde, la app arranca sin sesión (sin permisos) y avisa.
   */
  async loadSession(): Promise<void> {
    try {
      this.apply(await firstValueFrom(this._sessionService.getShell()));
    } catch (error) {
      this.clear();
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (this.canSwitchRole) await this.signInAs(EUserRole.AGENT).catch(() => undefined);
        return;
      }
      this._messageService.add({
        severity: 'error',
        summary: 'No se pudo conectar con el servidor',
        detail: 'Recarga la página en unos segundos.',
        sticky: true,
      });
    }
  }

  /** SOLO desarrollo: inicia sesión como el usuario sembrado de ese rol. */
  async signInAs(role: EUserRole): Promise<void> {
    const devSignIn = environment.devSignIn;
    if (!devSignIn) return;
    const shell = await firstValueFrom(
      this._sessionService.signIn({ email: devSignIn.emailByRole[role], password: devSignIn.password }),
    );
    this.apply(shell);
  }

  /**
   * Actualiza campos del usuario de la sesión (p. ej. el avatar tras guardarlo) SIN volver a pedir el
   * shell: el backend ya confirmó el cambio y el resto de la sesión no cambia.
   */
  patchUser(changes: Partial<NonNullable<TShell['user']>>): void {
    this.$_session.update((session) => (session ? { ...session, user: { ...session.user, ...changes } } : session));
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this._sessionService.signOut());
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.$_session.set(null);
    this._ability.update([]);
  }

  private apply(shell: TShell): void {
    this.$_session.set(shell);
    this._ability.update(shell.abilityRules);
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EUserRole } from '../../../core/casl/ability.enum';
import { ROLE_LABELS } from '../../../core/casl/role-labels.constants';
import { readProblem } from '../../../core/interfaces/problem-details.interface';
import { safeReturnUrl } from '../../../core/routing/safe-return-url.util';
import { SessionStore } from '../../../core/session/session.store';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { SIGN_IN_FORM } from '../auth-forms.config';
import { AuthService } from '../auth.service';
import type { TSignInForm } from '../auth.types';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Iniciar sesión. El destino al terminar es `?returnUrl=` (lo pone el guard al mandar aquí), SIEMPRE
 * validado con `safeReturnUrl`: una URL externa o de protocolo relativo jamás se sigue (open redirect).
 *
 * Errores: 401 (credenciales) y 429 (demasiados intentos) los muestra el toast de `errorInterceptor`;
 * 403 `SAUT-E008` (correo sin verificar) ADEMÁS se explica aquí con la acción de reenviar el enlace.
 */
@Component({
  selector: 'app-sign-in',
  imports: [Illustration, RouterLink, ButtonModule, MessageModule, DynamicForm],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})
export class SignIn {
  /** `?returnUrl=` (lo enlaza `withComponentInputBinding`). */
  readonly $returnUrl = input<string | undefined>(undefined, { alias: 'returnUrl' });

  private readonly _sessionStore = inject(SessionStore);
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _messageService = inject(MessageService);

  protected readonly form = SIGN_IN_FORM;
  protected readonly $submitting = signal(false);
  /** Correo que quedó pendiente de verificar (para ofrecer reenviar el enlace). */
  protected readonly $unverifiedEmail = signal<string | null>(null);
  protected readonly $resending = signal(false);
  /** Cuenta bloqueada por intentos fallidos: a quién pedirle el desbloqueo (administradores). */
  protected readonly $lockedContacts = signal<{ name: string; email: string }[] | null>(null);

  /** Solo desarrollo (`environment.devSignIn`): entrar con un usuario sembrado de un clic. */
  protected readonly devRoles = environment.devSignIn
    ? Object.values(EUserRole).map((role) => ({ role, label: ROLE_LABELS[role] }))
    : null;

  protected async onSubmit(value: TSignInForm): Promise<void> {
    this.$submitting.set(true);
    this.$unverifiedEmail.set(null);
    this.$lockedContacts.set(null);
    try {
      await this._sessionStore.signIn(value);
      await this.goToDestination();
    } catch (error) {
      const problem = error instanceof HttpErrorResponse ? readProblem(error) : null;
      if (problem?.code === 'SAUT-E008') this.$unverifiedEmail.set(value.email);
      if (problem?.code === 'SAUT-E014') {
        const contacts = problem.context?.['contacts'];
        this.$lockedContacts.set(Array.isArray(contacts) ? (contacts as { name: string; email: string }[]) : []);
      }
      // El resto (401, 429…) ya lo avisó `errorInterceptor`.
    } finally {
      this.$submitting.set(false);
    }
  }

  protected async onDevSignIn(role: EUserRole): Promise<void> {
    this.$submitting.set(true);
    try {
      await this._sessionStore.signInAs(role);
      await this.goToDestination();
    } finally {
      this.$submitting.set(false);
    }
  }

  protected async resend(): Promise<void> {
    const email = this.$unverifiedEmail();
    if (!email) return;
    this.$resending.set(true);
    try {
      const reply = await firstValueFrom(this._authService.resendVerification(email));
      this._messageService.add({ severity: 'success', summary: reply.message, life: 4000 });
    } catch {
      // 429 u otro: `errorInterceptor` ya avisó.
    } finally {
      this.$resending.set(false);
    }
  }

  private goToDestination(): Promise<boolean> {
    return this._router.navigateByUrl(safeReturnUrl(this.$returnUrl()));
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from '@openng/optimus-ui/message';
import { firstValueFrom } from 'rxjs';
import { readProblem } from '../../../core/interfaces/problem-details.interface';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { RESET_PASSWORD_FORM } from '../auth-forms.config';
import { AuthService } from '../auth.service';
import type { TResetPasswordForm } from '../auth.types';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Restablecer contraseña con el enlace del correo (`/reset-password?token=…`). El token es de UN solo
 * uso y vence en 45 min: si ya no sirve (400 `SAUT-E009`) se explica en la página con la salida
 * («pide otro enlace»). Una contraseña débil NO gasta el token: se corrige y se reintenta.
 */
@Component({
  selector: 'app-reset-password',
  imports: [Illustration, RouterLink, MessageModule, DynamicForm],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  /** `?token=` (lo enlaza `withComponentInputBinding`). */
  readonly $token = input<string | undefined>(undefined, { alias: 'token' });

  private readonly _authService = inject(AuthService);

  protected readonly form = RESET_PASSWORD_FORM;
  protected readonly $submitting = signal(false);
  protected readonly $status = signal<'form' | 'done' | 'expired'>('form');

  protected async onSubmit(value: TResetPasswordForm): Promise<void> {
    const token = this.$token();
    if (!token) return;
    this.$submitting.set(true);
    try {
      await firstValueFrom(this._authService.resetPassword(token, value.newPassword));
      this.$status.set('done');
    } catch (error) {
      // Enlace vencido o ya usado: se explica aquí. Contraseña débil (CVAL-E001) u otro error: toast.
      if (error instanceof HttpErrorResponse && readProblem(error)?.code === 'SAUT-E009') {
        this.$status.set('expired');
      }
    } finally {
      this.$submitting.set(false);
    }
  }
}

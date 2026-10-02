import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MessageModule } from '@openng/optimus-ui/message';
import { firstValueFrom } from 'rxjs';
import { readProblem } from '../../../core/interfaces/problem-details.interface';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { FORGOT_PASSWORD_FORM, RECOVER_PASSWORD_FORM, RECOVER_TOTP_FORM } from '../auth-forms.config';
import { AuthService } from '../auth.service';
import type {
  TAccountMessage,
  TForgotPasswordForm,
  TRecoverWithPasswordForm,
  TRecoverWithTotpForm,
  TRecoveryMethod,
} from '../auth.types';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/** Cada forma de recuperar el acceso: texto, ícono y lo que pide. */
interface IRecoveryOption {
  method: TRecoveryMethod;
  label: string;
  icon: string;
  lead: string;
}

const OPTIONS: readonly IRecoveryOption[] = [
  {
    method: 'email',
    label: 'Enlace por correo',
    icon: 'pi-envelope',
    lead: 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.',
  },
  {
    method: 'totp',
    label: 'Código del autenticador',
    icon: 'pi-mobile',
    lead: 'Usa el código de 6 dígitos de tu app autenticadora (TOTP) y elige una contraseña nueva. Solo si ya activaste el autenticador en Mi perfil → Seguridad.',
  },
  {
    method: 'current_password',
    label: 'Contraseña actual',
    icon: 'pi-key',
    lead: 'Confirma tu contraseña actual y elige una nueva. Útil si solo quieres cambiarla y aún entras a tu cuenta.',
  },
];

/**
 * Olvidé mi contraseña, con tres formas de recuperar el acceso: enlace por correo, código del autenticador
 * (TOTP) o contraseña actual. Las respuestas son siempre genéricas exista o no la cuenta (anti-enumeración):
 * esta pantalla nunca dice «ese correo no está registrado». En desarrollo muestra además el enlace del correo.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [Illustration, RouterLink, MessageModule, DynamicForm],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly _authService = inject(AuthService);

  protected readonly options = OPTIONS;
  protected readonly forms = { email: FORGOT_PASSWORD_FORM, totp: RECOVER_TOTP_FORM, current_password: RECOVER_PASSWORD_FORM };
  protected readonly $method = signal<TRecoveryMethod>('email');
  protected readonly $lead = computed(() => OPTIONS.find((option) => option.method === this.$method())?.lead ?? '');
  protected readonly $submitting = signal(false);
  protected readonly $reply = signal<TAccountMessage | null>(null);
  /** Contraseña cambiada con un segundo factor: se invita a iniciar sesión. */
  protected readonly $done = signal(false);
  protected readonly $error = signal<string | null>(null);

  protected choose(method: TRecoveryMethod): void {
    this.$method.set(method);
    this.$error.set(null);
  }

  protected async onSubmit(value: TForgotPasswordForm): Promise<void> {
    this.$submitting.set(true);
    try {
      this.$reply.set(await firstValueFrom(this._authService.forgotPassword(value.email)));
    } catch {
      // 429 u otro: `errorInterceptor` ya avisó.
    } finally {
      this.$submitting.set(false);
    }
  }

  protected onRecoverTotp(value: TRecoverWithTotpForm): Promise<void> {
    return this.recover({ method: 'totp', email: value.email, code: value.code, newPassword: value.newPassword });
  }

  protected onRecoverPassword(value: TRecoverWithPasswordForm): Promise<void> {
    return this.recover({
      method: 'current_password',
      email: value.email,
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    });
  }

  private async recover(dto: Parameters<AuthService['recoverPassword']>[0]): Promise<void> {
    this.$submitting.set(true);
    this.$error.set(null);
    try {
      await firstValueFrom(this._authService.recoverPassword(dto));
      this.$done.set(true);
    } catch (error) {
      const problem = error instanceof HttpErrorResponse ? readProblem(error) : null;
      // Misma frase para cualquier fallo de verificación: no se enumeran cuentas.
      this.$error.set(
        problem?.code === 'SAUT-E010'
          ? 'Los datos de verificación no son correctos. Revisa el correo y el código o la contraseña.'
          : (problem?.title ?? 'No se pudo completar. Inténtalo de nuevo en unos minutos.'),
      );
    } finally {
      this.$submitting.set(false);
    }
  }
}

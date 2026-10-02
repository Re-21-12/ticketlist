import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from '@openng/optimus-ui/message';
import { firstValueFrom } from 'rxjs';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { SIGN_UP_FORM } from '../auth-forms.config';
import { AuthService } from '../auth.service';
import type { TAccountMessage, TSignUpForm } from '../auth.types';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Crear cuenta. SIN confirmación por correo: la cuenta nace activa y con el rol de menor privilegio
 * (`VIEWER`; no hay campo de rol, el backend lo rechaza). Al terminar se invita a iniciar sesión en la misma pantalla.
 */
@Component({
  selector: 'app-sign-up',
  imports: [Illustration, RouterLink, MessageModule, DynamicForm],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
})
export class SignUp {
  private readonly _authService = inject(AuthService);

  protected readonly form = SIGN_UP_FORM;
  protected readonly $submitting = signal(false);
  protected readonly $done = signal<{ email: string; reply: TAccountMessage } | null>(null);

  protected async onSubmit(value: TSignUpForm): Promise<void> {
    this.$submitting.set(true);
    try {
      const reply = await firstValueFrom(
        this._authService.signUp({ name: value.name, email: value.email, password: value.password }),
      );
      this.$done.set({ email: value.email, reply });
    } catch {
      // 409 (correo repetido), 400 o 429: `errorInterceptor` ya avisó y el formulario conserva lo escrito.
    } finally {
      this.$submitting.set(false);
    }
  }
}

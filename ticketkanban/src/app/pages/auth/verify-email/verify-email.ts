import { afterNextRender, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';

type TVerifyState = 'verifying' | 'verified' | 'invalid';

/**
 * Verificar correo con el enlace de `/verify-email?token=…`. Corre UNA vez al abrir la página (el token
 * es de un solo uso: recargar mostraría «enlace no válido», y la pantalla lo explica). No se verifica
 * al servir la página sino al renderizar en el navegador: un enlace nunca debe consumirse por un
 * prefetch.
 */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
})
export class VerifyEmail {
  /** `?token=` (lo enlaza `withComponentInputBinding`). */
  readonly $token = input<string | undefined>(undefined, { alias: 'token' });

  private readonly _authService = inject(AuthService);
  protected readonly $state = signal<TVerifyState>('verifying');

  constructor() {
    afterNextRender(() => void this.verify());
  }

  private async verify(): Promise<void> {
    const token = this.$token();
    if (!token) return void this.$state.set('invalid');
    try {
      await firstValueFrom(this._authService.verifyEmail(token));
      this.$state.set('verified');
    } catch {
      // `SAUT-E009` (vencido/usado) u otro: la página lo explica; el toast va suprimido en el servicio.
      this.$state.set('invalid');
    }
  }
}

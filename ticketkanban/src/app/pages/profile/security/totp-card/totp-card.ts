import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { firstValueFrom } from 'rxjs';
import { DynamicForm } from '../../../../shared/dynamic-form/dynamic-form';
import { Badge } from '../../../../shared/ui/badge/badge';
import { ProfileService } from '../../profile.service';
import type { TTotpDisableForm, TTotpEnableForm, TTotpSetup } from '../../profile.types';
import { TOTP_DISABLE_FORM, TOTP_ENABLE_FORM } from '../../totp-form.config';
import { Illustration } from '../../../../shared/ui/illustration/illustration';

/** Dónde está la persona en el alta / baja del autenticador. */
type TStep = 'idle' | 'enrolling' | 'disabling';

/**
 * Autenticador (TOTP): segundo factor con el que se puede recuperar la contraseña sin el correo
 * (`/forgot-password`). Alta en dos pasos (secreto → confirmar con un código), baja con la contraseña actual.
 * El secreto se muestra UNA vez: si se pierde, se desactiva y se vuelve a configurar.
 */
@Component({
  selector: 'app-totp-card',
  imports: [Illustration, ButtonModule, DynamicForm, Badge],
  templateUrl: './totp-card.html',
  styleUrl: './totp-card.css',
})
export class TotpCard {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

  protected readonly enableForm = TOTP_ENABLE_FORM;
  protected readonly disableForm = TOTP_DISABLE_FORM;

  protected readonly $step = signal<TStep>('idle');
  protected readonly $setup = signal<TTotpSetup | null>(null);
  protected readonly $busy = signal(false);
  /** Código QR del `otpauth://` como imagen (se genera al configurar; `null` si no se pudo). */
  protected readonly $qr = signal<string | null>(null);
  protected readonly $enabled = computed(() => {
    const status = this._profileService.totp;
    return status.hasValue() ? status.value().enabled : false;
  });
  protected readonly $loaded = computed(() => this._profileService.totp.hasValue());
  /** El secreto en bloques de 4 para leerlo y escribirlo sin errores. */
  protected readonly $secretGroups = computed(() => this.$setup()?.secret.match(/.{1,4}/g)?.join(' ') ?? '');

  protected async start(): Promise<void> {
    this.$busy.set(true);
    try {
      const setup = await firstValueFrom(this._profileService.setupTotp());
      this.$setup.set(setup);
      this.$qr.set(await this.drawQr(setup.otpauthUrl));
      this.$step.set('enrolling');
    } catch {
      // `errorInterceptor` ya avisó.
    } finally {
      this.$busy.set(false);
    }
  }

  protected async confirm(value: TTotpEnableForm): Promise<void> {
    this.$busy.set(true);
    try {
      await firstValueFrom(this._profileService.enableTotp(value.code));
      this.finish('Autenticador activado', 'Ya puedes recuperar tu contraseña con el código de tu app.');
    } catch {
      // Código incorrecto: el aviso lo pone `errorInterceptor` y el formulario queda para reintentar.
    } finally {
      this.$busy.set(false);
    }
  }

  protected async disable(value: TTotpDisableForm): Promise<void> {
    this.$busy.set(true);
    try {
      await firstValueFrom(this._profileService.disableTotp(value.currentPassword));
      this.finish('Autenticador desactivado', 'Ya no se puede recuperar la contraseña con un código.');
    } catch {
      // Contraseña incorrecta: `errorInterceptor` ya avisó.
    } finally {
      this.$busy.set(false);
    }
  }

  protected cancel(): void {
    this.$step.set('idle');
    this.$setup.set(null);
    this.$qr.set(null);
  }

  /** El QR se genera en el navegador (el secreto nunca sale a un servicio externo) y la librería carga bajo demanda. */
  private async drawQr(url: string): Promise<string | null> {
    try {
      const { toDataURL } = await import('qrcode');
      return await toDataURL(url, { margin: 1, width: 192, errorCorrectionLevel: 'M' });
    } catch {
      return null; // sin QR queda la clave escrita
    }
  }

  private finish(summary: string, detail: string): void {
    this.$step.set('idle');
    this.$setup.set(null);
    this.$qr.set(null);
    this._profileService.totp.reload();
    this._messageService.add({ severity: 'success', summary, detail });
  }
}

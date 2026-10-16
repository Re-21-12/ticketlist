import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { firstValueFrom } from 'rxjs';
import { DynamicForm } from '../../../../shared/dynamic-form/dynamic-form';
import { downloadFile } from '../../../../shared/export/list-export.util';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Illustration } from '../../../../shared/ui/illustration/illustration';
import { ProfileService } from '../../profile.service';
import type { TTotpDisableForm, TTotpEnableForm, TTotpSetup } from '../../profile.types';
import { TOTP_DISABLE_FORM, TOTP_ENABLE_FORM } from '../../totp-form.config';

/** Dónde está la persona: en reposo, configurando (QR → código), guardando sus códigos de recuperación, o pidiendo baja/códigos nuevos. */
type TStep = 'idle' | 'enrolling' | 'codes' | 'disabling' | 'regenerating';

/**
 * Autenticador (TOTP): segundo factor con el que se recupera la contraseña sin el correo (`/forgot-password`).
 * Alta en tres pasos —escanear el QR (o copiar la clave), confirmar con un código y GUARDAR los 10 códigos de recuperación
 * de un solo uso— y baja con la contraseña actual. El secreto y los códigos se muestran UNA vez: si se pierden se vuelve a
 * configurar o se generan códigos nuevos (los anteriores dejan de valer).
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
  /** Códigos de recuperación recién generados (solo viven en esta pantalla hasta que la persona los guarda). */
  protected readonly $codes = signal<readonly string[]>([]);
  /** «Ya guardé mis códigos»: sin esto no se cierra el panel (después no se vuelven a mostrar). */
  protected readonly $saved = signal(false);
  protected readonly $enabled = computed(() => {
    const status = this._profileService.totp;
    return status.hasValue() ? status.value().enabled : false;
  });
  protected readonly $loaded = computed(() => this._profileService.totp.hasValue());
  protected readonly $codesLeft = computed(() => {
    const status = this._profileService.totp;
    return status.hasValue() ? status.value().recoveryCodesLeft : 0;
  });
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
      const { recoveryCodes } = await firstValueFrom(this._profileService.enableTotp(value.code));
      this.showCodes(recoveryCodes);
      this._profileService.totp.reload();
    } catch {
      // Código incorrecto: el aviso lo pone `errorInterceptor` y el formulario queda para reintentar.
    } finally {
      this.$busy.set(false);
    }
  }

  /** Códigos nuevos: los anteriores dejan de valer. Pide la contraseña actual. */
  protected async regenerate(value: TTotpDisableForm): Promise<void> {
    this.$busy.set(true);
    try {
      const { recoveryCodes } = await firstValueFrom(this._profileService.regenerateRecoveryCodes(value.currentPassword));
      this.showCodes(recoveryCodes);
      this._profileService.totp.reload();
    } catch {
      // Contraseña incorrecta: `errorInterceptor` ya avisó.
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

  protected setSaved(event: Event): void {
    this.$saved.set((event.target as HTMLInputElement).checked);
  }

  /** Terminar solo se permite tras confirmar que se guardaron: después los códigos no se vuelven a mostrar. */
  protected done(): void {
    if (!this.$saved()) return;
    this.$codes.set([]);
    this.$saved.set(false);
    this.$step.set('idle');
    this._messageService.add({ severity: 'success', summary: 'Autenticador activo', detail: 'Guarda tus códigos en un lugar seguro.', life: 4000 });
  }

  protected async copySecret(): Promise<void> {
    await this.copy(this.$setup()?.secret ?? '', 'Clave copiada');
  }

  protected async copyCodes(): Promise<void> {
    await this.copy(this.$codes().join('\n'), 'Códigos copiados');
  }

  protected downloadCodes(): void {
    downloadFile(new Blob([this.codesText()], { type: 'text/plain;charset=utf-8' }), 'ticketit-codigos-de-recuperacion.txt');
    this.$saved.set(true);
  }

  /** Imprime solo los códigos en una ventana propia (el resto de la pantalla no sale en el papel). */
  protected printCodes(): void {
    const popup = window.open('', '_blank', 'width=480,height=640');
    if (!popup) {
      this._messageService.add({ severity: 'warn', summary: 'No se pudo abrir la impresión', detail: 'Permite las ventanas emergentes o descarga el archivo.' });
      return;
    }
    const items = this.$codes().map((code) => `<li>${code}</li>`).join('');
    popup.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Códigos de recuperación</title><style>body{font-family:system-ui,sans-serif;padding:2rem}li{font:600 1.25rem ui-monospace,monospace;margin:.5rem 0;list-style:none}</style></head><body><h1>Ticketit · códigos de recuperación</h1><p>Cada código sirve una sola vez. Guárdalos en un lugar seguro.</p><ul>${items}</ul></body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
    this.$saved.set(true);
  }

  private showCodes(codes: readonly string[]): void {
    this.$codes.set(codes);
    this.$saved.set(false);
    this.$setup.set(null);
    this.$qr.set(null);
    this.$step.set('codes');
  }

  private codesText(): string {
    return `Ticketit · códigos de recuperación (cada uno sirve una sola vez)\n\n${this.$codes().join('\n')}\n`;
  }

  private async copy(text: string, summary: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this._messageService.add({ severity: 'success', summary, life: 2500 });
    } catch {
      this._messageService.add({ severity: 'warn', summary: 'No se pudo copiar', detail: 'Selecciona el texto y cópialo a mano.' });
    }
  }

  /** El QR se genera en el navegador (el secreto nunca sale a un servicio externo) y la librería carga bajo demanda. */
  private async drawQr(url: string): Promise<string | null> {
    try {
      const { toDataURL } = await import('qrcode');
      return await toDataURL(url, { margin: 2, width: 224, errorCorrectionLevel: 'M' });
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

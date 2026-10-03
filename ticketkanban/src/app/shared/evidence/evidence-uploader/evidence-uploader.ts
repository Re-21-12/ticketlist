import { Component, computed, inject, input, model, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EVIDENCE_ACCEPT, EVIDENCE_KIND_META, EVIDENCE_MAX_FILES, EVIDENCE_MAX_VIDEO_SECONDS, EVIDENCE_TYPES_TEXT } from '../evidence.constants';
import { EvidenceService } from '../evidence.service';
import type { TAttachmentRef } from '../evidence.types';
import { checkEvidenceFile, formatBytes, formatDuration } from '../evidence.util';

/**
 * Selector de EVIDENCIA para un ticket: imágenes, PDF, Excel, CSV, texto y videos cortos (≤ 5 min). Valida cada archivo
 * ANTES de subirlo (tipo, tamaño por familia y duración del video) y, si no cumple, dice por qué y pide otro (A2 de CU02).
 * Lo que pasa se sube al bucket (por la API) y queda en `$attachments`, listo para enviarse con el comentario o el cambio
 * de estado. El servidor repite todas las comprobaciones.
 */
@Component({
  selector: 'app-evidence-uploader',
  templateUrl: './evidence-uploader.html',
  styleUrl: './evidence-uploader.css',
})
export class EvidenceUploader {
  private readonly _evidence = inject(EvidenceService);

  readonly $ticketUuid = input.required<string>();
  /** Los archivos ya subidos (ids de adjunto que se mandan con el comentario). Doble vía. */
  readonly $attachments = model<TAttachmentRef[]>([]);
  /** `true` mientras hay una subida en curso (el formulario padre deshabilita «Enviar»). Doble vía. */
  readonly $busy = model(false);
  readonly $inputId = input('evidence-input');

  protected readonly accept = EVIDENCE_ACCEPT;
  protected readonly typesText = EVIDENCE_TYPES_TEXT;
  protected readonly maxFiles = EVIDENCE_MAX_FILES;
  protected readonly maxVideo = formatDuration(EVIDENCE_MAX_VIDEO_SECONDS);
  protected readonly kindMeta = EVIDENCE_KIND_META;
  protected readonly format = { bytes: formatBytes, duration: formatDuration };

  protected readonly $errors = signal<string[]>([]);
  protected readonly $canAdd = computed(() => this.$attachments().length < EVIDENCE_MAX_FILES && !this.$busy());

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    if (files.length === 0) return;
    this.$errors.set([]);
    this.$busy.set(true);
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (this.$attachments().length >= EVIDENCE_MAX_FILES) {
          errors.push(`Solo se pueden adjuntar ${EVIDENCE_MAX_FILES} archivos por vez: «${file.name}» no se agregó.`);
          continue;
        }
        const check = await checkEvidenceFile(file);
        if (!check.ok) {
          errors.push(check.message ?? `«${file.name}» no se puede adjuntar.`);
          continue;
        }
        try {
          const uploaded = await firstValueFrom(this._evidence.upload(this.$ticketUuid(), file));
          this.$attachments.update((current) => [...current, uploaded]);
        } catch {
          // El servidor es la última palabra (tipo por firma, duración, bucket): `errorInterceptor` ya mostró el motivo.
          errors.push(`«${file.name}» no se pudo subir. Elige otro archivo o inténtalo de nuevo.`);
        }
      }
    } finally {
      this.$busy.set(false);
      this.$errors.set(errors);
    }
  }

  protected remove(id: string): void {
    this.$attachments.update((current) => current.filter((attachment) => attachment.id !== id));
  }
}

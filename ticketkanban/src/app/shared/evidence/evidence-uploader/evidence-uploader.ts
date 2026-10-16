import { Component, computed, ElementRef, inject, input, model, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_KIND_META,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_MAX_VIDEO_SECONDS,
  EVIDENCE_MIME_BY_KIND,
  EVIDENCE_TYPES_TEXT,
} from '../evidence.constants';
import { EvidencePreview } from '../evidence-preview/evidence-preview';
import { EvidenceService } from '../evidence.service';
import type { TAttachmentRef, TEvidenceDraft } from '../evidence.types';
import { blobUrl, checkEvidenceFile, formatBytes, formatDuration } from '../evidence.util';

/**
 * Selector de EVIDENCIA para un ticket: imágenes, PDF, Excel, CSV, texto y videos cortos (≤ 5 min). Valida cada archivo
 * ANTES de subirlo (tipo, tamaño por familia y duración del video) y, si no cumple, dice por qué y pide otro (A2 de CU02).
 * Lo que pasa se sube al bucket (por la API) y queda en `$attachments`, listo para enviarse con el comentario o el cambio
 * de estado. El servidor repite todas las comprobaciones.
 *
 * Zona de ARRASTRAR Y SOLTAR (patrón de wallet-api) con el botón como alternativa accesible. Los archivos elegidos se
 * listan de inmediato como PENDIENTES, con vista previa, y se van mandando al bucket sin bloquear la interfaz: la
 * persona ve qué adjuntó y puede quitarlo mientras el resto sube.
 */
@Component({
  selector: 'app-evidence-uploader',
  imports: [EvidencePreview],
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
  protected readonly dropzoneHint = `${EVIDENCE_TYPES_TEXT}: imágenes hasta ${formatBytes(EVIDENCE_MAX_BYTES.image)}, documentos hasta ${formatBytes(EVIDENCE_MAX_BYTES.document)}, videos hasta ${formatBytes(EVIDENCE_MAX_BYTES.video)} y ${formatDuration(EVIDENCE_MAX_VIDEO_SECONDS)}. Máximo ${EVIDENCE_MAX_FILES} archivos.`;

  protected readonly $errors = signal<string[]>([]);
  private readonly $_drafts = signal<TEvidenceDraft[]>([]);
  protected readonly $drafts = this.$_drafts.asReadonly();
  /** El límite es por ARCHIVO (5), no por envío: los pendientes también lo cuentan. */
  protected readonly $canAdd = computed(
    () => this.$attachments().length + this.$drafts().length < EVIDENCE_MAX_FILES && !this.$busy(),
  );
  private readonly $_dragOver = signal(false);
  protected readonly $dragOver = this.$_dragOver.asReadonly();

  private readonly $_fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly $_preview = viewChild.required(EvidencePreview);
  /** Profundidad del arrastre: `dragenter`/`dragleave` se disparan por cada elemento hijo, así que
   *  un booleano haría parpadear el resaltado al cruzar los hijos (mismo criterio que wallet-api). */
  private _dragDepth = 0;

  protected openPicker(): void {
    this.$_fileInput().nativeElement.click();
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    void this.add(files);
  }

  // ── Arrastrar y soltar ────────────────────────────────────────────────────────────────────────
  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this._dragDepth++;
    this.$_dragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.$_dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this._dragDepth = Math.max(0, this._dragDepth - 1);
    if (this._dragDepth === 0) this.$_dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this._dragDepth = 0;
    this.$_dragOver.set(false);
    if (!this.$canAdd()) return;
    void this.add([...(event.dataTransfer?.files ?? [])]);
  }

  /**
   * Valida los archivos, los publica como pendientes (con su URL local para la vista previa) y
   * sube uno por uno. Cada error va a `$errors` sin cortar el resto: un archivo malo no impide
   * adjuntar los demás.
   */
  private async add(files: File[]): Promise<void> {
    if (files.length === 0) return;
    this.$errors.set([]);
    const errors: string[] = [];
    const accepted: { draft: TEvidenceDraft; file: File }[] = [];

    for (const file of files) {
      if (this.$attachments().length + this.$drafts().length + accepted.length >= EVIDENCE_MAX_FILES) {
        errors.push(`Solo se pueden adjuntar ${EVIDENCE_MAX_FILES} archivos por vez: «${file.name}» no se agregó.`);
        continue;
      }
      const check = await checkEvidenceFile(file);
      if (!check.ok || !check.kind) {
        errors.push(check.message ?? `«${file.name}» no se puede adjuntar.`);
        continue;
      }
      accepted.push({
        draft: {
          token: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type || EVIDENCE_MIME_BY_KIND[check.kind],
          size: file.size,
          kind: check.kind,
          url: blobUrl(file),
        },
        file,
      });
    }

    if (accepted.length === 0) {
      this.$errors.set(errors);
      return;
    }
    this.$_drafts.update((current) => [...current, ...accepted.map((entry) => entry.draft)]);
    this.$busy.set(true);
    try {
      for (const { draft, file } of accepted) {
        try {
          const uploaded = await firstValueFrom(this._evidence.upload(this.$ticketUuid(), file));
          this.$attachments.update((current) => [...current, uploaded]);
          this.dropDraft(draft.token);
        } catch {
          // El servidor es la última palabra (tipo por firma, duración, bucket): `errorInterceptor` ya mostró el motivo.
          errors.push(`«${file.name}» no se pudo subir. Elige otro archivo o inténtalo de nuevo.`);
          this.removeDraft(draft.token);
        }
      }
    } finally {
      this.$busy.set(false);
      this.$errors.set(errors);
    }
  }

  protected removeDraft(token: string): void {
    this.dropDraft(token);
  }

  /** Saca el pendiente de la lista y libera su URL local (si no, el blob queda en memoria). */
  private dropDraft(token: string): void {
    const draft = this.$_drafts().find((entry) => entry.token === token);
    this.$_drafts.update((current) => current.filter((entry) => entry.token !== token));
    if (draft?.url) URL.revokeObjectURL(draft.url);
  }

  protected previewDraft(draft: TEvidenceDraft): void {
    this.$_preview().showDraft(draft);
  }

  protected previewAttachment(attachment: TAttachmentRef): void {
    this.$_preview().showAttachment(attachment);
  }

  protected remove(id: string): void {
    this.$attachments.update((current) => current.filter((attachment) => attachment.id !== id));
  }
}
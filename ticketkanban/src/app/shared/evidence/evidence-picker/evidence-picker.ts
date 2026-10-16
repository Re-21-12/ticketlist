import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { EVIDENCE_ACCEPT, EVIDENCE_KIND_META, EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, EVIDENCE_MAX_VIDEO_SECONDS, EVIDENCE_TYPES_TEXT } from '../evidence.constants';
import type { TAttachmentKind } from '../evidence.types';
import { checkEvidenceFile, formatBytes, formatDuration } from '../evidence.util';

/** Un archivo ya validado que espera a que exista el ticket para subirse. */
export interface IPickedEvidence {
  id: string;
  file: File;
  kind: TAttachmentKind;
}

/**
 * Selector de evidencia para cuando el ticket TODAVÍA NO EXISTE (alta rápida): valida cada archivo con las mismas reglas que
 * `app-evidence-uploader` (tipo, tope por familia, video ≤ 5 min; A2 de CU02) pero NO sube nada: entrega los archivos
 * válidos en `$files` y quien lo usa los sube al crear el ticket (el bucket guarda la evidencia POR ticket).
 */
@Component({
  selector: 'app-evidence-picker',
  templateUrl: './evidence-picker.html',
  styleUrl: './evidence-picker.css',
})
export class EvidencePicker {
  /** Los archivos válidos elegidos (doble vía). */
  readonly $files = model<IPickedEvidence[]>([]);
  readonly $inputId = input('evidence-picker-input');
  readonly $disabled = input(false);

  protected readonly accept = EVIDENCE_ACCEPT;
  protected readonly typesText = EVIDENCE_TYPES_TEXT;
  protected readonly kindMeta = EVIDENCE_KIND_META;
  protected readonly format = { bytes: formatBytes };
  protected readonly hint = `${EVIDENCE_TYPES_TEXT}: imágenes hasta ${formatBytes(EVIDENCE_MAX_BYTES.image)}, documentos hasta ${formatBytes(EVIDENCE_MAX_BYTES.document)}, videos hasta ${formatBytes(EVIDENCE_MAX_BYTES.video)} y ${formatDuration(EVIDENCE_MAX_VIDEO_SECONDS)}. Máximo ${EVIDENCE_MAX_FILES} archivos.`;

  protected readonly $errors = signal<string[]>([]);
  protected readonly $canAdd = computed(() => !this.$disabled() && this.$files().length < EVIDENCE_MAX_FILES);
  private readonly $_over = signal(false);
  protected readonly $over = this.$_over.asReadonly();
  private readonly $_input = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private _depth = 0;

  protected openPicker(): void {
    this.$_input().nativeElement.click();
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    void this.add(files);
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this._depth++;
    this.$_over.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.$_over.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this._depth = Math.max(0, this._depth - 1);
    if (this._depth === 0) this.$_over.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this._depth = 0;
    this.$_over.set(false);
    if (this.$canAdd()) void this.add([...(event.dataTransfer?.files ?? [])]);
  }

  protected remove(id: string): void {
    this.$files.update((current) => current.filter((entry) => entry.id !== id));
  }

  /** Valida y suma lo que cumple; cada rechazo va a `$errors` con su motivo sin cortar el resto (A2). */
  private async add(files: File[]): Promise<void> {
    if (files.length === 0) return;
    const errors: string[] = [];
    const accepted: IPickedEvidence[] = [];
    for (const file of files) {
      if (this.$files().length + accepted.length >= EVIDENCE_MAX_FILES) {
        errors.push(`Solo se pueden adjuntar ${EVIDENCE_MAX_FILES} archivos: «${file.name}» no se agregó.`);
        continue;
      }
      const check = await checkEvidenceFile(file);
      if (!check.ok || !check.kind) {
        errors.push(check.message ?? `«${file.name}» no se puede adjuntar.`);
        continue;
      }
      accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, kind: check.kind });
    }
    this.$errors.set(errors);
    if (accepted.length > 0) this.$files.update((current) => [...current, ...accepted]);
  }
}

import { Component, computed, inject, input, signal } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { EVIDENCE_KIND_META } from '../evidence.constants';
import { EvidenceService } from '../evidence.service';
import type { TAttachmentKind, TAttachmentRef, TEvidenceDraft } from '../evidence.types';
import { formatBytes, formatDuration } from '../evidence.util';

/** Lo que se está previsualizando: o un adjunto ya subido, o un archivo local aún sin subir. */
interface IPreviewTarget {
  name: string;
  mimeType: string;
  size: number;
  kind: TAttachmentKind;
  url: string;
  durationSeconds: number | null;
}

/**
 * Vista previa de evidencia, SOLO LECTURA. Un único `p-dialog` para los tres formatos: imagen
 * ampliada, video con controles y PDF en el visor nativo del navegador (`iframe` sin
 * `allow`s de escritura). No hay edición, impresión ni subida: la descarga es un botón aparte y
 * explícito, y el PDF va en un iframe de origen servido por la API (el bucket es privado).
 */
@Component({
  selector: 'app-evidence-preview',
  imports: [ButtonModule, DialogModule],
  templateUrl: './evidence-preview.html',
  styleUrl: './evidence-preview.css',
})
export class EvidencePreview {
  private readonly _evidence = inject(EvidenceService);

  readonly $ticketUuid = input<string | undefined>(undefined);
  /** Adjuntos ya subidos del bucket: quien los muestra puede abrirlos con `showAttachment`. */
  readonly $attachments = input<readonly TAttachmentRef[]>([]);

  private readonly $_target = signal<IPreviewTarget | null>(null);
  protected readonly $target = this.$_target.asReadonly();
  protected readonly $isPdf = computed(() => this.$_target()?.mimeType === 'application/pdf');
  protected readonly kindMeta = EVIDENCE_KIND_META;
  protected readonly format = { bytes: formatBytes, duration: formatDuration };

  /** URL de un adjunto del bucket (privado: viaja por la API con la cookie de sesión). */
  protected url(attachment: TAttachmentRef): string {
    return this._evidence.url(this.$ticketUuid() ?? '', attachment.id);
  }

  /** Abre la vista previa de un adjunto ya subido. Lo llama quien tiene la lista (`app-attachment-list`,
   *  `app-evidence-uploader`) a través de su `viewChild`. */
  showAttachment(attachment: TAttachmentRef): void {
    this.$_target.set({
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
      url: this.url(attachment),
      durationSeconds: attachment.durationSeconds,
    });
  }

  /** Abre la vista previa de un archivo local todavía sin subir. */
  showDraft(draft: TEvidenceDraft): void {
    this.$_target.set({
      name: draft.name,
      mimeType: draft.mimeType,
      size: draft.size,
      kind: draft.kind,
      url: draft.url,
      durationSeconds: null,
    });
  }

  protected close(): void {
    this.$_target.set(null);
  }

  /** Nombre de descarga sugerido, sin directorios: el `name` viene del navegador, no del servidor. */
  protected downloadName(target: IPreviewTarget): string {
    return target.name.replace(/[\\/]/g, '-');
  }
}
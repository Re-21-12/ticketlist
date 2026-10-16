import { Component, inject, input, viewChild } from '@angular/core';
import { EVIDENCE_KIND_META } from '../evidence.constants';
import { EvidencePreview } from '../evidence-preview/evidence-preview';
import { EvidenceService } from '../evidence.service';
import type { TAttachmentRef } from '../evidence.types';
import { formatBytes, formatDuration } from '../evidence.util';

/**
 * Evidencia de un renglón del historial: la imagen se ve en miniatura (y «Ver» la abre en el visor
 * de solo lectura), el video tiene su reproductor y el resto (PDF, Excel, CSV, texto) también se
 * puede VER — antes solo se descargaba. Todo viaja por la API (misma origin, con la cookie de
 * sesión): el bucket no es público.
 */
@Component({
  selector: 'app-attachment-list',
  imports: [EvidencePreview],
  templateUrl: './attachment-list.html',
  styleUrl: './attachment-list.css',
})
export class AttachmentList {
  private readonly _evidence = inject(EvidenceService);

  readonly $attachments = input.required<readonly TAttachmentRef[]>();
  readonly $ticketUuid = input.required<string>();

  protected readonly kindMeta = EVIDENCE_KIND_META;
  protected readonly format = { bytes: formatBytes, duration: formatDuration };

  private readonly $_preview = viewChild.required(EvidencePreview);

  protected url(attachment: TAttachmentRef): string {
    return this._evidence.url(this.$ticketUuid(), attachment.id);
  }

  protected openPreview(attachment: TAttachmentRef): void {
    this.$_preview().showAttachment(attachment);
  }
}
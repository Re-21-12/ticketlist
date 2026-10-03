import { Component, computed, inject, signal, type Signal } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DynamicDialogConfig } from '@openng/optimus-ui/dynamicdialog';
import { EvidenceUploader } from '../../../shared/evidence/evidence-uploader/evidence-uploader';
import type { TAttachmentRef } from '../../../shared/evidence/evidence.types';
import { TicketResolveFormSchema } from '../ticket.schema';

/** Lo que recibe el modal «Resolver»: el ticket, el estado de guardado y qué hacer al enviar. */
export interface IResolveDialogData {
  ticketUuid: string;
  code: string;
  submitting: Signal<boolean>;
  onSubmit: (payload: { resolution: string; attachmentIds: string[] }) => void;
}

const RESOLUTION_MAX = 2000;

/**
 * Modal «Resolver»: la solución (obligatoria) y la EVIDENCIA de lo que se hizo (fotos del antes y el después, informes,
 * videos cortos), que el solicitante verá en su historial. Se abre con `DialogService`; NO se cierra al enviar (si el
 * request falla queda abierto para reintentar): quien lo abrió lo cierra tras guardar.
 */
@Component({
  selector: 'app-resolve-dialog',
  imports: [ButtonModule, EvidenceUploader],
  templateUrl: './resolve-dialog.html',
  styleUrl: './resolve-dialog.css',
})
export class ResolveDialog {
  protected readonly _config = inject<DynamicDialogConfig<IResolveDialogData>>(DynamicDialogConfig);
  protected readonly data = this._config.data as IResolveDialogData;

  protected readonly resolutionMax = RESOLUTION_MAX;
  protected readonly $text = signal('');
  protected readonly $error = signal<string | null>(null);
  protected readonly $evidence = signal<TAttachmentRef[]>([]);
  protected readonly $uploading = signal(false);
  protected readonly $busy = computed(() => this.data.submitting() || this.$uploading());

  protected setText(event: Event): void {
    this.$text.set((event.target as HTMLTextAreaElement).value);
    this.$error.set(null);
  }

  protected submit(): void {
    const parsed = TicketResolveFormSchema.safeParse({ resolution: this.$text() });
    if (!parsed.success) {
      this.$error.set(parsed.error.issues[0]?.message ?? 'Documenta la solución');
      return;
    }
    this.data.onSubmit({ resolution: parsed.data.resolution, attachmentIds: this.$evidence().map((attachment) => attachment.id) });
  }
}

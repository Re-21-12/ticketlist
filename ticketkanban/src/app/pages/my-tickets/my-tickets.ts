import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { CanPipe } from '../../core/casl/can.pipe';
import { AttachmentList } from '../../shared/evidence/attachment-list/attachment-list';
import { EvidenceUploader } from '../../shared/evidence/evidence-uploader/evidence-uploader';
import type { TAttachmentRef } from '../../shared/evidence/evidence.types';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import { Badge } from '../../shared/ui/badge/badge';
import { Illustration } from '../../shared/ui/illustration/illustration';
import { SurveyDialogService } from '../tickets/survey/survey-dialog.service';
import { SLA_STATE_META } from '../tickets/ticket.constants';
import { COMMENT_MAX, CommentFormSchema } from './my-tickets.schema';
import { SYNC_STATE_META, TICKET_EVENT_META } from './my-tickets.constants';
import { MyTicketsStore } from './my-tickets.store';

/**
 * «Mis tickets» (CU01 y CU02): lo que registró la persona con su estado actual, el detalle y el historial de interacciones
 * (incluidos los avisos que se le enviaron), comentar con evidencia (imágenes, PDF, Excel, CSV, videos cortos) y, si el
 * ticket está «Resuelto», ver la solución y elegir «Confirmar cierre» o «Reabrir ticket». Los comentarios previos no se
 * editan. Se actualiza en tiempo real (SSE); si la conexión en vivo falla muestra una alerta de sincronización y deja
 * actualizar a mano. Sin tickets, lo dice y ofrece crear uno.
 */
@Component({
  selector: 'app-my-tickets',
  imports: [AttachmentList, Badge, ButtonModule, CanPipe, DatePipe, EvidenceUploader, Illustration, RouterLink],
  providers: [DialogService, FormDialogService, SurveyDialogService],
  templateUrl: './my-tickets.html',
  styleUrl: './my-tickets.css',
})
export class MyTickets {
  protected readonly _store = inject(MyTicketsStore);
  private readonly _survey = inject(SurveyDialogService);
  private readonly _messageService = inject(MessageService);
  /** `?ticket=<uuid>`: el ticket abierto (deep link desde la campana de notificaciones). */
  readonly $ticket = input<string | undefined>(undefined, { alias: 'ticket' });

  protected readonly syncMeta = SYNC_STATE_META;
  protected readonly eventMeta = TICKET_EVENT_META;
  protected readonly slaMeta = SLA_STATE_META;
  protected readonly commentMax = COMMENT_MAX;

  protected readonly $draft = signal('');
  protected readonly $draftError = signal<string | null>(null);
  protected readonly $evidence = signal<TAttachmentRef[]>([]);
  protected readonly $uploading = signal(false);
  protected readonly $reopenReason = signal('');
  /** Motivo con que el backend rechazó editar un comentario previo (A1), por comentario. */
  protected readonly $editNotices = signal<Record<string, string>>({});

  /** Un ticket cerrado ya no admite comentarios (el backend responde 409). */
  protected readonly $canComment = computed(() => {
    const selected = this._store.$selected();
    return !!selected && selected.status !== 'closed';
  });
  /** «Resuelto» y la persona puede confirmar o reabrir (el backend lo decide en `nextStatuses`). */
  protected readonly $awaitingConfirmation = computed(() => {
    const selected = this._store.$selected();
    return !!selected && selected.status === 'resolved' && selected.nextStatuses.includes('closed');
  });
  protected readonly $canReopen = computed(() => this._store.$selected()?.nextStatuses.includes('reopened') ?? false);

  /** Historial listo para pintar: etiqueta de cada estado en lugar del código. */
  protected readonly $timeline = computed(() => {
    const state = this._store.$eventsState();
    if (state.kind !== 'success') return [];
    const status = this._store.$statusByCode();
    return state.data.data.map((event) => ({
      ...event,
      meta: TICKET_EVENT_META[event.type],
      fromLabel: event.from ? (status[event.from]?.label ?? event.from) : null,
      toLabel: event.to ? (status[event.to]?.label ?? event.to) : null,
      /** Solo lo escrito por el propio solicitante (un comentario suyo): ahí se ofrece «Editar» (que el sistema impide). */
      ownComment: event.type === 'COMMENT_PUBLIC' && event.actor === 'customer',
    }));
  });

  /** Fotos y archivos con que se documentó la solución (el cambio a «Resuelto»), para mostrarlos junto al resumen. */
  protected readonly $resolutionEvidence = computed(() => {
    const state = this._store.$eventsState();
    if (state.kind !== 'success') return [];
    return [...state.data.data].reverse().find((event) => event.type === 'STATUS_CHANGED' && event.to === 'resolved')?.attachments ?? [];
  });

  constructor() {
    effect(() => this._store.select(this.$ticket()));
  }

  protected setDraft(event: Event): void {
    this.$draft.set((event.target as HTMLTextAreaElement).value);
    this.$draftError.set(null);
  }

  protected setReason(event: Event): void {
    this.$reopenReason.set((event.target as HTMLTextAreaElement).value);
  }

  protected async send(): Promise<void> {
    const parsed = CommentFormSchema.safeParse({ body: this.$draft() });
    if (!parsed.success) {
      this.$draftError.set(parsed.error.issues[0]?.message ?? 'Escribe tu comentario');
      return;
    }
    try {
      await this._store.comment(
        parsed.data.body,
        this.$evidence().map((attachment) => attachment.id),
      );
      this.$draft.set('');
      this.$evidence.set([]);
    } catch {
      // `errorInterceptor` ya avisó; el texto y la evidencia se conservan para reintentar.
    }
  }

  /** Confirma el cierre y, ya cerrado, abre la encuesta (¿se resolvió?, calificación, comentario opcional). */
  protected async confirmClosure(): Promise<void> {
    const uuid = this._store.$selectedUuid();
    if (!(await this._store.confirmClosure()) || !uuid) return;
    this._messageService.add({ severity: 'success', summary: 'Ticket cerrado', detail: 'Gracias por confirmarlo.', life: 3000 });
    await this._survey.rate(uuid);
  }

  protected async reopen(): Promise<void> {
    if (!(await this._store.reopen(this.$reopenReason().trim() || undefined))) return;
    this.$reopenReason.set('');
    this._messageService.add({ severity: 'success', summary: 'Ticket reabierto', detail: 'Avisamos al agente asignado.', life: 3500 });
  }

  /** A1: el sistema impide editar un comentario previo y lo dice junto a él. */
  protected async attemptEdit(commentUuid: string, body: string | null): Promise<void> {
    const reason = await this._store.attemptEdit(commentUuid, body ?? '');
    this.$editNotices.update((current) => ({ ...current, [commentUuid]: reason }));
  }
}

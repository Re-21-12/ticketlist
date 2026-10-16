import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService, type DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import { EUserRole } from '../../core/casl/ability.enum';
import { CanPipe } from '../../core/casl/can.pipe';
import { AttachmentList } from '../../shared/evidence/attachment-list/attachment-list';
import { EvidenceUploader } from '../../shared/evidence/evidence-uploader/evidence-uploader';
import type { TAttachmentRef } from '../../shared/evidence/evidence.types';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import { SummaryCard } from '../../shared/ui/summary-card/summary-card';
import { TICKET_REOPEN_FORM } from '../tickets/ticket-form.config';
import { closureSummary, reopenSummary } from '../tickets/survey/closure-summary.util';
import { Badge } from '../../shared/ui/badge/badge';
import { Illustration } from '../../shared/ui/illustration/illustration';
import type { TTicketStatus } from '../tickets/ticket.types';
import type { IResolveDialogData } from '../tickets/resolve-dialog/resolve-dialog';
import { SurveyDialogService } from '../tickets/survey/survey-dialog.service';
import { SLA_STATE_META } from '../tickets/ticket.constants';
import { COMMENT_MAX, CommentFormSchema } from './my-tickets.schema';
import { SYNC_STATE_META, THREAD_SCOPE_META, THREAD_SCOPES, TICKET_EVENT_META, type TThreadScope } from './my-tickets.constants';
import { MyTicketsStore } from './my-tickets.store';
import { SessionStore } from '../../core/session/session.store';

/**
 * Hilo del EQUIPO de soporte (misma pantalla): «Asignados a mí» / «Todos» / «Registrados por mí», el historial completo con
 * las notas internas, responder con evidencia (comentario público o nota interna) y cambiar el estado (resolver abre el
 * modal con la solución y su evidencia). Para el solicitante es «Mis tickets» (abajo).
 *
 * «Mis tickets» (CU01 y CU02): lo que registró la persona con su estado actual, el detalle y el historial de interacciones
 * (incluidos los avisos que se le enviaron), comentar con evidencia (imágenes, PDF, Excel, CSV, videos cortos) y, si el
 * ticket está «Resuelto», ver la solución y elegir «Confirmar cierre» o «Reabrir ticket». Los comentarios previos no se
 * editan. Se actualiza en tiempo real (SSE); si la conexión en vivo falla muestra una alerta de sincronización y deja
 * actualizar a mano. Sin tickets, lo dice y ofrece crear uno.
 */
@Component({
  selector: 'app-my-tickets',
  imports: [AttachmentList, Badge, SummaryCard, ButtonModule, CanPipe, DatePipe, EvidenceUploader, Illustration, RouterLink],
  providers: [DialogService, FormDialogService, SurveyDialogService],
  templateUrl: './my-tickets.html',
  styleUrl: './my-tickets.css',
})
export class MyTickets {
  protected readonly _store = inject(MyTicketsStore);
  private readonly _survey = inject(SurveyDialogService);
  private readonly _formDialog = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _sessionStore = inject(SessionStore);
  private readonly _dialogService = inject(DialogService);
  private _resolveRef: DynamicDialogRef | null = null;
  /** `?ticket=<uuid>`: el ticket abierto (deep link desde la campana de notificaciones). */
  readonly $ticket = input<string | undefined>(undefined, { alias: 'ticket' });

  protected readonly syncMeta = SYNC_STATE_META;
  protected readonly eventMeta = TICKET_EVENT_META;
  protected readonly slaMeta = SLA_STATE_META;
  protected readonly commentMax = COMMENT_MAX;
  protected readonly $scopes = computed(() => {
    const role = this._sessionStore.$role();
    // SUPERVISOR doesn't typically have tickets assigned to them as an individual agent - hide "assigned"
    if (role === EUserRole.SUPERVISOR) {
      return THREAD_SCOPES.filter((v) => v !== 'assigned').map((value) => ({ value, ...THREAD_SCOPE_META[value] }));
    }
    return THREAD_SCOPES.map((value) => ({ value, ...THREAD_SCOPE_META[value] }));
  });
  protected readonly $internal = signal(false);
  protected readonly $resolving = signal(false);

  /** El equipo (agente, supervisor, administrador) trabaja el ticket desde aquí; el solicitante lo sigue. */
  protected readonly $isTeam = this._sessionStore.$isTeam;
  protected readonly $title = computed(() => (this.$isTeam() ? 'Hilo de tickets' : 'Mis tickets'));
  protected readonly $subtitle = computed(() =>
    this.$isTeam()
      ? 'Lee el hilo completo de cada ticket, responde a la persona o deja una nota interna y cambia su estado.'
      : 'Tus solicitudes con su estado actual. Cuando el equipo cambia algo, te avisamos aquí y en la campana.',
  );
  /** Pasos de estado que ESTA persona puede dar ahora (los decide el backend en `nextStatuses`). */
  protected readonly $teamActions = computed(() => {
    const selected = this._store.$selected();
    if (!selected || !this.$isTeam() || this.$awaitingConfirmation()) return [];
    const labels = this._store.$statusByCode();
    return selected.nextStatuses.map((status) => ({ status, label: labels[status]?.label ?? status, icon: labels[status]?.icon ?? 'pi-arrow-right' }));
  });

  protected readonly $draft = signal('');
  protected readonly $draftError = signal<string | null>(null);
  protected readonly $evidence = signal<TAttachmentRef[]>([]);
  protected readonly $uploading = signal(false);
  /** Mientras se envía el motivo de reapertura (bloquea el doble envío del diálogo). */
  protected readonly $reopening = signal(false);
  /** Motivo con que el backend rechazó editar un comentario previo (A1), por comentario. */
  protected readonly $editNotices = signal<Record<string, string>>({});

  /** Un ticket cerrado ya no admite comentarios (el backend responde 409). */
  protected readonly $canComment = computed(() => {
    const selected = this._store.$selected();
    // El auditor solo lee: el backend le negaría el comentario.
    return !!selected && selected.status !== 'closed' && this._sessionStore.$role() !== EUserRole.AUDITOR;
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

  /** Resumen de un ticket CERRADO (la pantalla «Cierre del ticket» del diseño): fechas, quién lo atendió y la solución. */
  protected readonly $closureCard = computed(() => {
    const selected = this._store.$selected();
    return selected && selected.status === 'closed' ? closureSummary(selected) : null;
  });

  /** Fotos y archivos con que se documentó la solución (el cambio a «Resuelto»), para mostrarlos junto al resumen. */
  protected readonly $resolutionEvidence = computed(() => {
    const state = this._store.$eventsState();
    if (state.kind !== 'success') return [];
    return [...state.data.data].reverse().find((event) => event.type === 'STATUS_CHANGED' && event.to === 'resolved')?.attachments ?? [];
  });

  constructor() {
    // El store vive toda la sesión: al ABRIR la pantalla se vuelve a pedir la lista (un ticket creado hace un momento
    // desde el alta rápida no genera ningún aviso que la refresque, y quedaba fuera hasta la siguiente recarga).
    this._store.reload();
    effect(() => this._store.select(this.$ticket()));
    // El equipo arranca en «Asignados a mí»; el solicitante, en lo que registró.
    // Para SUPERVISOR no hay scope "assigned", usar "all" o "mine" según contexto
    effect(() => {
      const team = this.$isTeam();
      const role = this._sessionStore.$role();
      untracked(() => {
        if (team && role === EUserRole.SUPERVISOR) {
          this._store.setScope('all');
        } else if (team) {
          this._store.setScope('assigned');
        } else {
          this._store.setScope('mine');
        }
      });
    });
    // Un enlace (campana) a un ticket que no está en el alcance actual: se amplía a «Todos» para no dejar la pantalla vacía.
    effect(() => {
      const state = this._store.$listState();
      const uuid = this.$ticket();
      if (state.kind === 'success' && uuid && this.$isTeam() && this._store.$scope() !== 'all' && !state.data.data.some((t) => t.uuid === uuid)) {
        untracked(() => this._store.setScope('all'));
      }
    });
  }

  protected setScope(scope: TThreadScope): void {
    this._store.setScope(scope);
  }

  protected setInternal(event: Event): void {
    this.$internal.set((event.target as HTMLInputElement).checked);
  }

  /** Cambio de estado del equipo: resolver pide la solución (y su evidencia) en un modal; el resto va directo. */
  protected async moveTo(status: TTicketStatus, label: string): Promise<void> {
    if (status === 'resolved') {
      await this.openResolve();
      return;
    }
    // Reabrir exige el motivo: se pide en el diálogo antes de mover el ticket.
    if (status === 'reopened') {
      await this.reopen();
      return;
    }
    if (await this._store.move(status)) {
      this._messageService.add({ severity: 'success', summary: `Ticket movido a ${label}`, life: 2500 });
    }
  }

  private async openResolve(): Promise<void> {
    const ticket = this._store.$selected();
    if (!ticket || this._resolveRef) return;
    const { ResolveDialog } = await import('../tickets/resolve-dialog/resolve-dialog');
    const data: IResolveDialogData = {
      ticketUuid: ticket.uuid,
      code: ticket.code,
      submitting: this.$resolving,
      onSubmit: ({ resolution, attachmentIds }) => {
        this.$resolving.set(true);
        void this._store.move('resolved', { resolution, attachmentIds }).then((moved) => {
          this.$resolving.set(false);
          if (moved) this.closeResolve();
        });
      },
    };
    this._resolveRef = this._dialogService.open(ResolveDialog, {
      header: `Resolver ${ticket.code}`,
      modal: true,
      dismissableMask: false,
      closeOnEscape: false,
      style: { width: '95vw', maxWidth: '40rem' },
      contentStyle: { 'max-height': '75vh', 'overflow-y': 'auto' },
      data,
    });
    this._resolveRef?.onClose.subscribe(() => (this._resolveRef = null));
  }

  private closeResolve(): void {
    this._resolveRef?.close();
    this._resolveRef = null;
  }

  protected setDraft(event: Event): void {
    this.$draft.set((event.target as HTMLTextAreaElement).value);
    this.$draftError.set(null);
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
        this.$isTeam() && this.$internal(),
      );
      this.$draft.set('');
      this.$internal.set(false);
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

  /** «Reabrir ticket»: pide el MOTIVO (obligatorio) en un diálogo con la solución a la vista, y solo entonces reabre. */
  protected reopen(): Promise<void> {
    const ticket = this._store.$selected();
    if (!ticket) return Promise.resolve();
    return this._formDialog.open({
      header: 'Reabrir ticket',
      definition: TICKET_REOPEN_FORM,
      summary: reopenSummary(ticket),
      submitLabel: 'Enviar comentario y reabrir',
      submitting: this.$reopening,
      onSubmit: ({ reason }) => void this.sendReopen(reason),
    });
  }

  private async sendReopen(reason: string): Promise<void> {
    this.$reopening.set(true);
    try {
      if (!(await this._store.reopen(reason))) return; // `errorInterceptor` ya avisó y el diálogo queda abierto
      this._formDialog.close();
      this._messageService.add({ severity: 'success', summary: 'Ticket reabierto', detail: 'Tu motivo quedó en el historial y avisamos al agente asignado.', life: 3500 });
    } finally {
      this.$reopening.set(false);
    }
  }

  /** A1: el sistema impide editar un comentario previo y lo dice junto a él. */
  protected async attemptEdit(commentUuid: string, body: string | null): Promise<void> {
    const reason = await this._store.attemptEdit(commentUuid, body ?? '');
    this.$editNotices.update((current) => ({ ...current, [commentUuid]: reason }));
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CanPipe } from '../../core/casl/can.pipe';
import { Badge } from '../../shared/ui/badge/badge';
import { Illustration } from '../../shared/ui/illustration/illustration';
import { SLA_STATE_META } from '../tickets/ticket.constants';
import { COMMENT_MAX, CommentFormSchema } from './my-tickets.schema';
import { SYNC_STATE_META, TICKET_EVENT_META } from './my-tickets.constants';
import { MyTicketsStore } from './my-tickets.store';

/**
 * «Mis tickets» (CU01): lo que registró la persona con su estado actual, el detalle y el historial de interacciones
 * (incluidos los avisos que se le enviaron), y la posibilidad de comentar. Se actualiza en tiempo real (SSE); si la
 * conexión en vivo falla muestra una alerta de sincronización y deja actualizar a mano (A2). Sin tickets, lo dice y
 * ofrece crear uno (A1).
 */
@Component({
  selector: 'app-my-tickets',
  imports: [Badge, ButtonModule, CanPipe, DatePipe, Illustration, RouterLink],
  templateUrl: './my-tickets.html',
  styleUrl: './my-tickets.css',
})
export class MyTickets {
  protected readonly _store = inject(MyTicketsStore);
  /** `?ticket=<uuid>`: el ticket abierto (deep link desde la campana de notificaciones). */
  readonly $ticket = input<string | undefined>(undefined, { alias: 'ticket' });

  protected readonly syncMeta = SYNC_STATE_META;
  protected readonly eventMeta = TICKET_EVENT_META;
  protected readonly slaMeta = SLA_STATE_META;
  protected readonly commentMax = COMMENT_MAX;

  protected readonly $draft = signal('');
  protected readonly $draftError = signal<string | null>(null);
  /** Un ticket cerrado ya no admite comentarios (el backend responde 409). */
  protected readonly $canComment = computed(() => {
    const selected = this._store.$selected();
    return !!selected && selected.status !== 'closed';
  });

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
    }));
  });

  constructor() {
    effect(() => this._store.select(this.$ticket()));
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
      await this._store.comment(parsed.data.body);
      this.$draft.set('');
    } catch {
      // `errorInterceptor` ya avisó; el texto se conserva para reintentar.
    }
  }
}

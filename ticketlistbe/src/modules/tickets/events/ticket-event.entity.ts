import type { ITicketEventFact, TTicketEventType } from '../sla/ticket-analysis.js';
import type { TTicketStatus } from '../lifecycle/ticket-lifecycle.js';

/** Referencia a un adjunto dentro de un comentario (el contenido vive en `TicketAttachmentsRepository`). */
export interface IAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Un renglón INMUTABLE del historial del ticket (docs/standard/metrics.md §2). Es la única fuente de
 * las métricas y de la trazabilidad: no se edita ni se borra, la corrección es otro evento.
 */
export interface ITicketEvent extends ITicketEventFact {
  uuid: string;
  ticketUuid: string;
  type: TTicketEventType;
  /** `public` lo ve el cliente; `internal` solo el equipo (notas). */
  visibility: 'public' | 'internal';
  actorUuid: string | null;
  actorName: string;
  /** `COMMENT_*`: el texto. `STATUS_CHANGED`: la solución o el motivo. */
  body: string | null;
  attachments: IAttachmentRef[];
  /** `ASSIGNED`: a quién se asignó (correo). */
  assignee: string | null;
  /** `CREATED`: estado inicial. */
  status?: TTicketStatus;
}

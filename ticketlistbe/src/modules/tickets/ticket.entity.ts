import { BaseEntity } from '../../core/base.entity.js';
import type { TTicketStatus } from './lifecycle/ticket-lifecycle.js';
import type { TICKET_CATEGORY, TICKET_COMPLEXITY, TICKET_PRIORITY, TICKET_TYPE } from './schemas/ticket.schema.js';

export class TicketEntity extends BaseEntity {
  /** TITULAR: quien creó el ticket. Siempre puede gestionarlo y es quien lo comparte. */
  ownerUuid!: string;
  code!: string;
  title!: string;
  description!: string;
  type!: (typeof TICKET_TYPE)[number];
  category!: (typeof TICKET_CATEGORY)[number];
  /** Departamento de origen (código de `ticket-department`; `it` = interno de TI). */
  department!: string;
  complexity!: (typeof TICKET_COMPLEXITY)[number] | null;
  otherCategoryDetail!: string | null;
  priority!: (typeof TICKET_PRIORITY)[number];
  /** Solo cambia por una transición (`TicketLifecycleService`), nunca por `PATCH`. */
  status!: TTicketStatus;
  assigneeEmail!: string;
  estimateHours!: number | null;
  /** Columna `date` (sin hora): se guarda 'YYYY-MM-DD'. */
  dueDate!: string | null;
  notifyReporter!: boolean;
  /** Plazos de SLA vigentes AL CREARSE (minutos hábiles): cambiar la política no reescribe el pasado. */
  slaResponseMinutes!: number;
  slaResolutionMinutes!: number;
  /** Solución documentada al resolver. */
  resolution!: string | null;
  resolvedAt!: Date | null;
  closedAt!: Date | null;
}

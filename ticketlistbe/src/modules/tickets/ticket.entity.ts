import { BaseEntity } from '../../core/base.entity.js';
import type { TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS } from './schemas/ticket.schema.js';

export class TicketEntity extends BaseEntity {
  /** TITULAR: quien creó el ticket. Siempre puede gestionarlo y es quien lo comparte. */
  ownerUuid!: string;
  code!: string;
  title!: string;
  description!: string;
  category!: (typeof TICKET_CATEGORY)[number];
  otherCategoryDetail!: string | null;
  priority!: (typeof TICKET_PRIORITY)[number];
  status!: (typeof TICKET_STATUS)[number];
  assigneeEmail!: string;
  estimateHours!: number | null;
  /** Columna `date` (sin hora): se guarda 'YYYY-MM-DD'. */
  dueDate!: string | null;
  notifyReporter!: boolean;
}

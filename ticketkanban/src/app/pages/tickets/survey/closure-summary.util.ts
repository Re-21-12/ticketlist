import { formatCell } from '../../../shared/dynamic-table/utils/cell-format';
import type { ISummaryCard } from '../../../shared/ui/summary-card/summary-card';
import type { TTicket } from '../ticket.types';

const when = (value: Date | null): string => (value ? formatCell({ v: value }, { field: 'v', header: '', dataType: 'datetime' }) : '—');

/** Datos del resumen de un ticket (cierre, reapertura): ID, fechas, quién lo atendió y la solución aplicada. */
function facts(ticket: TTicket, closedLabel: string): ISummaryCard['facts'] {
  return [
    { label: 'Ticket', value: ticket.code },
    { label: 'Fecha de apertura', value: when(ticket.createdAt) },
    { label: closedLabel, value: when(ticket.closedAt ?? ticket.resolvedAt) },
    { label: 'Atendido por', value: ticket.assigneeName ?? 'Sin responsable' },
  ];
}

const solution = (ticket: TTicket): ISummaryCard['note'] => (ticket.resolution ? { label: 'Solución aplicada', text: ticket.resolution } : undefined);

/** Tarjeta de la pantalla «Cierre del ticket»: «Tu ticket TCK-001 ha sido cerrado» + resumen del caso. */
export function closureSummary(ticket: TTicket): ISummaryCard {
  const note = solution(ticket);
  return { title: `Tu ticket ${ticket.code} ha sido cerrado`, subtitle: ticket.title, facts: facts(ticket, 'Fecha de cierre'), ...(note ? { note } : {}) };
}

/** Tarjeta del diálogo «Reabrir»: el ticket y la solución que el solicitante está rechazando. */
export function reopenSummary(ticket: TTicket): ISummaryCard {
  const note = solution(ticket);
  return { title: `${ticket.code} · ${ticket.title}`, subtitle: 'Solución que se aplicó', facts: facts(ticket, 'Resuelto el'), ...(note ? { note } : {}) };
}

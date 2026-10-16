import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { IExportTable } from '../../../shared/export/list-export.interface';
import { ListExport } from '../../../shared/export/list-export';
import { stamp } from '../../../shared/export/list-export.util';
import { Badge } from '../../../shared/ui/badge/badge';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from '../../tickets/ticket.constants';
import type { TTicketPriority } from '../../tickets/ticket.types';
import { RESOLUTION_STATUS_META } from '../metrics.constants';
import type { TAgentTicketRow } from '../metrics.types';

const RESPONSE_META = {
  met: { label: 'En plazo', icon: 'pi-check', severity: 'success' },
  breached: { label: 'Fuera de plazo', icon: 'pi-exclamation-circle', severity: 'danger' },
  pending: { label: 'Sin responder', icon: 'pi-clock', severity: 'secondary' },
} as const;

/** Tickets que gestionó una persona del equipo, con el estado de su SLA (A2: los vencidos salen «Fuera de SLA»). */
@Component({
  selector: 'app-metric-tickets',
  imports: [Badge, DatePipe, ListExport],
  templateUrl: './metric-tickets.html',
  styleUrl: './metric-tickets.css',
})
export class MetricTickets {
  readonly $tickets = input.required<readonly TAgentTicketRow[]>();

  /** Reporte de los tickets gestionados (el mismo texto que ve la tabla). */
  protected readonly $export = computed<IExportTable>(() => ({
    title: 'Tickets gestionados',
    fileName: `tickets-gestionados-${stamp(new Date())}`,
    headers: ['Ticket', 'Título', 'Estado', 'Urgencia', 'Primera respuesta', 'SLA de resolución', 'Vence', '1.er contacto', 'CSAT'],
    rows: this.$rows().map((row) => [
      row.code,
      row.title,
      row.statusMeta.label,
      row.priorityMeta.label,
      row.responseMeta.label,
      row.resolutionMeta.label,
      row.resolutionDueAt ? new Date(row.resolutionDueAt).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—',
      row.firstContact === null ? '—' : row.firstContact ? 'Sí' : 'No',
      row.csat === null ? '—' : `${row.csat} / 5`,
    ]),
  }));

  protected readonly $rows = computed(() =>
    this.$tickets().map((t) => ({
      ...t,
      statusMeta: TICKET_STATUS_META[t.status],
      priorityMeta: TICKET_PRIORITY_META[t.priority as TTicketPriority] ?? { label: t.priority, icon: null, severity: 'secondary' as const },
      responseMeta: RESPONSE_META[t.responseStatus],
      resolutionMeta: RESOLUTION_STATUS_META[t.resolutionStatus],
    })),
  );
}

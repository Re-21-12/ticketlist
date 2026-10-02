import { Component, computed, inject } from '@angular/core';
import { Badge } from '../../../shared/ui/badge/badge';
import { SERVICE_TARGETS, SLA_RANGES } from '../ticket.constants';
import { TicketsStore } from '../tickets.store';

/**
 * Referencia de plazos de servicio (SLA) por urgencia, con las metas que se miden. Plegable: la urgencia usa
 * la misma insignia (ícono y color del catálogo) que las tarjetas.
 */
@Component({
  selector: 'app-sla-ranges',
  imports: [Badge],
  templateUrl: './sla-ranges.html',
  styleUrl: './sla-ranges.css',
})
export class SlaRanges {
  private readonly _ticketsStore = inject(TicketsStore);

  protected readonly targets = SERVICE_TARGETS;
  protected readonly $rows = computed(() => {
    const byCode = this._ticketsStore.$priorityByCode();
    return SLA_RANGES.map((range) => ({ ...range, badge: byCode[range.priority] }));
  });
}

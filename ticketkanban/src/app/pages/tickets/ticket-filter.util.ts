import type { TTicket } from './ticket.types';

/** Filtros de búsqueda de tickets; `''` / `false` = sin filtrar por ese criterio. */
export interface ITicketFilters {
  search: string;
  department: string;
  priority: string;
  type: string;
  category: string;
  status: string;
  /** Solo lo que atiendo o solicité yo. */
  mine: boolean;
  /** Solo lo que ya superó su plazo de resolución. */
  breached: boolean;
}

export const EMPTY_TICKET_FILTERS: ITicketFilters = {
  search: '',
  department: '',
  priority: '',
  type: '',
  category: '',
  status: '',
  mine: false,
  breached: false,
};

/** Cuántos criterios están activos (para el aviso «n filtros» y para ofrecer «Limpiar»). */
export function activeFilterCount(filters: ITicketFilters): number {
  return (Object.keys(EMPTY_TICKET_FILTERS) as (keyof ITicketFilters)[]).filter((key) => !!filters[key]).length;
}

/** Los criterios que el backend sabe filtrar (`GET /api/tickets`): el listado paginado los envía; el tablero filtra todo en el cliente. */
export function serverFilters(filters: ITicketFilters): Record<string, string> | undefined {
  const entries = (['status', 'priority', 'type', 'category', 'department'] as const)
    .filter((key) => !!filters[key])
    .map((key) => [key, filters[key]] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Aplica los filtros a una lista de tickets (el tablero, que ya trae todo). Búsqueda sin acentos ni mayúsculas. */
export function filterTickets(tickets: readonly TTicket[], filters: ITicketFilters, me: { uuid: string; email: string } | null): TTicket[] {
  const term = normalize(filters.search.trim());
  return tickets.filter((ticket) => {
    if (filters.department && ticket.department !== filters.department) return false;
    if (filters.priority && ticket.priority !== filters.priority) return false;
    if (filters.type && ticket.type !== filters.type) return false;
    if (filters.category && ticket.category !== filters.category) return false;
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.mine && !(me && (ticket.assigneeEmail === me.email || ticket.ownerUuid === me.uuid))) return false;
    if (filters.breached && !(ticket.sla.resolutionStatus === 'breached' && ticket.status !== 'closed' && ticket.status !== 'resolved')) return false;
    if (term) {
      const haystack = normalize([ticket.code, ticket.title, ticket.assigneeName ?? '', ticket.assigneeEmail, ticket.requesterName].join(' '));
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

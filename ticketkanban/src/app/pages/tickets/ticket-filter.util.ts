import { businessDayEnd, businessDayStart } from '../../core/time/business-day.util';
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
  /** Rango por FECHA DE REGISTRO (`YYYY-MM-DD`), ambos extremos inclusivos y en UTC. */
  createdFrom: string;
  createdTo: string;
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
  createdFrom: '',
  createdTo: '',
};

/** Techo del rango, el mismo que el del backend (`MAX_DATE_RANGE_DAYS`) y que el de métricas. */
export const MAX_DATE_RANGE_DAYS = 366;

/** Los dos extremos del rango son UN criterio, no dos: el aviso dice «2 filtros», no «3». */
const DATE_KEYS = ['createdFrom', 'createdTo'] as const;

/** Cuántos criterios están activos (para el aviso «n filtros» y para ofrecer «Limpiar»). */
export function activeFilterCount(filters: ITicketFilters): number {
  const single = (Object.keys(EMPTY_TICKET_FILTERS) as (keyof ITicketFilters)[]).filter(
    (key) => !DATE_KEYS.includes(key as (typeof DATE_KEYS)[number]),
  );
  const others = single.filter((key) => !!filters[key]).length;
  return others + (filters.createdFrom || filters.createdTo ? 1 : 0);
}

/** Los criterios que el backend sabe filtrar (`GET /api/tickets`): el listado paginado los envía; el tablero filtra todo en el cliente. */
export function serverFilters(filters: ITicketFilters): Record<string, string> | undefined {
  const entries = (['status', 'priority', 'type', 'category', 'department', 'createdFrom', 'createdTo'] as const)
    .filter((key) => !!filters[key])
    .map((key) => [key, filters[key]] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Instantes del rango, con el mismo criterio del backend (`ticket-date-range.ts`): una fecha sin hora es el DÍA LOCAL del negocio
 *  (UTC−6) y un `createdTo` de SOLO fecha llega al último milisegundo de ese día, para que «Hoy» no deje fuera lo de hace un minuto
 *  (ni lo registrado de noche, que en UTC ya es el día siguiente). */
function rangeBounds(filters: ITicketFilters): { from: number; to: number } | null {
  if (!filters.createdFrom && !filters.createdTo) return null;
  const from = filters.createdFrom ? businessDayStart(filters.createdFrom).getTime() : -Infinity;
  const to = filters.createdTo ? businessDayEnd(filters.createdTo).getTime() : Infinity;
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return { from, to };
}

/** Aplica los filtros a una lista de tickets (el tablero, que ya trae todo). Búsqueda sin acentos ni mayúsculas. */
export function filterTickets(tickets: readonly TTicket[], filters: ITicketFilters, me: { uuid: string; email: string } | null): TTicket[] {
  const term = normalize(filters.search.trim());
  const dates = rangeBounds(filters);
  return tickets.filter((ticket) => {
    if (filters.department && ticket.department !== filters.department) return false;
    if (filters.priority && ticket.priority !== filters.priority) return false;
    if (filters.type && ticket.type !== filters.type) return false;
    if (filters.category && ticket.category !== filters.category) return false;
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.mine && !(me && (ticket.assigneeEmail === me.email || ticket.ownerUuid === me.uuid))) return false;
    if (filters.breached && !(ticket.sla.resolutionStatus === 'breached' && ticket.status !== 'closed' && ticket.status !== 'resolved')) return false;
    if (dates) {
      const at = new Date(ticket.createdAt).getTime();
      if (at < dates.from || at > dates.to) return false;
    }
    if (term) {
      const haystack = normalize([ticket.code, ticket.title, ticket.assigneeName ?? '', ticket.assigneeEmail, ticket.requesterName].join(' '));
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

/**
 * Por qué no se puede aplicar un rango, o `null` si sí. Los mismos criterios del backend
 * (`TCK.DATE_RANGE_ORDER` / `TCK.DATE_RANGE_TOO_LONG`): se avisa antes de consultar para que el
 * listado no se quede en blanco esperando un 400.
 */
export function dateRangeError(from: string, to: string): string | null {
  if (!from || !to) return null;
  // Las fechas son `YYYY-MM-DD`: compararlas como texto es comparar el calendario, sin zona horaria.
  if (from > to) return 'La fecha final no puede ser anterior a la inicial';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_DATE_RANGE_DAYS) return `El filtro no puede abarcar más de ${MAX_DATE_RANGE_DAYS} días`;
  return null;
}

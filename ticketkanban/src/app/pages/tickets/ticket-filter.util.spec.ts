import { activeFilterCount, EMPTY_TICKET_FILTERS, filterTickets, serverFilters } from './ticket-filter.util';
import type { TTicket } from './ticket.types';

const make = (over: Partial<TTicket>): TTicket =>
  ({
    code: 'TCK-001',
    title: 'Falla de red',
    department: 'it',
    priority: 'high',
    type: 'incident',
    category: 'network',
    status: 'in_progress',
    assigneeEmail: 'ana@ticketit.dev',
    assigneeName: 'Ana Agente',
    ownerUuid: 'owner-1',
    requesterName: 'Rosa Recursos Humanos',
    sla: { resolutionStatus: 'running' },
    ...over,
  }) as TTicket;

const tickets = [
  make({ code: 'TCK-001' }),
  make({ code: 'TCK-002', title: 'Nómina no abre', department: 'hr', priority: 'low', category: 'software', assigneeEmail: '', assigneeName: null, ownerUuid: 'me', status: 'new' }),
  make({ code: 'TCK-003', title: 'Correo caído', department: 'finance', sla: { resolutionStatus: 'breached' } as TTicket['sla'] }),
  make({ code: 'TCK-004', status: 'closed', sla: { resolutionStatus: 'breached' } as TTicket['sla'] }),
];
const me = { uuid: 'me', email: 'victor@ticketit.dev' };
const codes = (filters: Partial<typeof EMPTY_TICKET_FILTERS>) => filterTickets(tickets, { ...EMPTY_TICKET_FILTERS, ...filters }, me).map((t) => t.code);

describe('filterTickets', () => {
  it('sin filtros devuelve todo', () => expect(codes({})).toHaveLength(4));

  it('por departamento, urgencia, categoría y estado', () => {
    expect(codes({ department: 'hr' })).toEqual(['TCK-002']);
    expect(codes({ priority: 'low' })).toEqual(['TCK-002']);
    expect(codes({ category: 'software' })).toEqual(['TCK-002']);
    expect(codes({ status: 'closed' })).toEqual(['TCK-004']);
  });

  it('la búsqueda ignora acentos y mayúsculas y mira código, título, responsable y solicitante', () => {
    expect(codes({ search: 'NOMINA' })).toEqual(['TCK-002']);
    expect(codes({ search: 'tck-003' })).toEqual(['TCK-003']);
    expect(codes({ search: 'agente' })).toEqual(['TCK-001', 'TCK-003', 'TCK-004']);
    expect(codes({ search: 'recursos humanos' })).toHaveLength(4);
  });

  it('«solo mis tickets»: los que atiendo o solicité', () => {
    expect(codes({ mine: true })).toEqual(['TCK-002']);
  });

  it('«fuera de SLA» no cuenta lo ya cerrado', () => {
    expect(codes({ breached: true })).toEqual(['TCK-003']);
  });

  it('los criterios se combinan (Y)', () => {
    expect(codes({ department: 'finance', priority: 'high' })).toEqual(['TCK-003']);
    expect(codes({ department: 'hr', priority: 'high' })).toEqual([]);
  });
});

describe('filtros activos y filtros de servidor', () => {
  it('cuenta los criterios activos', () => {
    expect(activeFilterCount(EMPTY_TICKET_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_TICKET_FILTERS, department: 'hr', mine: true })).toBe(2);
  });

  it('al servidor solo van los que el backend filtra', () => {
    expect(serverFilters(EMPTY_TICKET_FILTERS)).toBeUndefined();
    expect(serverFilters({ ...EMPTY_TICKET_FILTERS, department: 'hr', mine: true, search: 'x' })).toEqual({ department: 'hr' });
  });
});

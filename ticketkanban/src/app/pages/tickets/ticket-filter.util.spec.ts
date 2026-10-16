import { describe, expect, it } from 'vitest';
import { activeFilterCount, dateRangeError, EMPTY_TICKET_FILTERS, filterTickets, serverFilters } from './ticket-filter.util';
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
  make({ code: 'TCK-001', createdAt: new Date('2026-10-03T09:00:00.000Z') }),
  make({ code: 'TCK-002', title: 'Nómina no abre', department: 'hr', priority: 'low', category: 'software', assigneeEmail: '', assigneeName: null, ownerUuid: 'me', status: 'new', createdAt: new Date('2026-10-01T18:00:00.000Z') }),
  make({ code: 'TCK-003', title: 'Correo caído', department: 'finance', sla: { resolutionStatus: 'breached' } as TTicket['sla'], createdAt: new Date('2026-10-03T23:59:00.000Z') }),
  make({ code: 'TCK-004', status: 'closed', sla: { resolutionStatus: 'breached' } as TTicket['sla'], createdAt: new Date('2026-09-28T12:00:00.000Z') }),
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

/**
 * El detalle que este filtro tiene que cumplir y que `new Date()` no da solo: un rango de SOLO FECHA
 * incluye el día COMPLETO, para que «Hoy» no se quede fuera lo registrado hace un minuto (mismo
 * criterio que `ticket-date-range.ts` del backend, con el extremo final en el último milisegundo).
 */
describe('filtro por fecha de registro', () => {
  it('«Hoy» incluye todo lo del día, hasta el último instante', () => {
    expect(codes({ createdFrom: '2026-10-03', createdTo: '2026-10-03' })).toEqual(['TCK-001', 'TCK-003']);
    expect(codes({ createdFrom: '2026-10-01', createdTo: '2026-10-01' })).toEqual(['TCK-002']);
  });

  it('un rango de varios días: los extremos van dentro y los de afuera no', () => {
    expect(codes({ createdFrom: '2026-09-28', createdTo: '2026-10-01' })).toEqual(['TCK-002', 'TCK-004']);
  });

  it('un extremo abierto filtra hacia atrás o hacia adelante', () => {
    expect(codes({ createdFrom: '2026-10-03' })).toEqual(['TCK-001', 'TCK-003']);
    expect(codes({ createdTo: '2026-10-01' })).toEqual(['TCK-002', 'TCK-004']);
  });

  it('se combina con los otros criterios', () => {
    expect(codes({ department: 'finance', createdFrom: '2026-10-03', createdTo: '2026-10-03' })).toEqual(['TCK-003']);
    expect(codes({ department: 'hr', createdFrom: '2026-10-03', createdTo: '2026-10-03' })).toEqual([]);
  });

  it('los dos extremos cuentan como UN criterio activo', () => {
    expect(activeFilterCount({ ...EMPTY_TICKET_FILTERS, createdFrom: '2026-10-01', createdTo: '2026-10-03' })).toBe(1);
    expect(activeFilterCount({ ...EMPTY_TICKET_FILTERS, createdFrom: '2026-10-01', department: 'hr' })).toBe(2);
  });

  it('el rango va al servidor (los dos parámetros)', () => {
    expect(serverFilters({ ...EMPTY_TICKET_FILTERS, createdFrom: '2026-10-01', createdTo: '2026-10-03' })).toEqual({
      createdFrom: '2026-10-01',
      createdTo: '2026-10-03',
    });
    expect(serverFilters({ ...EMPTY_TICKET_FILTERS, createdFrom: '2026-10-01', mine: true })).toEqual({ createdFrom: '2026-10-01' });
  });

  it('avisa antes de consultar si el rango no sirve (final ≥ inicial y ≤ 366 días)', () => {
    expect(dateRangeError('', '')).toBeNull();
    expect(dateRangeError('2026-10-01', '')).toBeNull();
    expect(dateRangeError('2026-10-01', '2026-10-03')).toBeNull();
    expect(dateRangeError('2026-10-03', '2026-10-01')).toBe('La fecha final no puede ser anterior a la inicial');
    expect(dateRangeError('2020-01-01', '2026-10-03')).toContain('366');
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
import { TicketUpsertSchema } from './ticket.schema';
import { toAssigneeOptions, toTicketUpsert } from './ticket.mapper';
import type { TTicket } from './ticket.types';

const ticket: TTicket = {
  uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
  code: 'TCK-001',
  ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
  createdAt: new Date('2026-09-20T15:00:00Z'),
  requesterName: 'Ana Agente',
  assigneeName: 'Ana Agente',
  resolution: null,
  resolvedAt: null,
  closedAt: null,
  reopenCount: 0,
  nextStatuses: ['pending_customer', 'escalated', 'resolved'],
  sla: {
    responseMinutes: 120,
    resolutionMinutes: 120,
    responseStatus: 'met',
    resolutionStatus: 'running',
    responseDueAt: new Date('2026-09-20T17:00:00Z'),
    resolutionDueAt: new Date('2026-09-20T17:00:00Z'),
  },
  title: 'El login con Google devuelve 500',
  description: 'Ocurre solo con cuentas de Workspace.',
  department: 'hr',
  type: 'incident',
  category: 'access',
  complexity: 'moderate',
  attendedSince: new Date('2026-09-20T16:00:00Z'),
  priority: 'critical',
  status: 'in_progress',
  assigneeEmail: 'ana@ticketit.dev',
  estimateHours: 6,
  dueDate: new Date(2026, 9, 2),
  notifyReporter: true,
};

describe('toTicketUpsert (mover una tarjeta reenvía el ticket con un campo distinto)', () => {
  it('cambia solo lo pedido y deja pasar el contrato de PATCH', () => {
    const dto = toTicketUpsert(ticket, { priority: 'high' });
    expect(dto.priority).toBe('high');
    expect(dto.title).toBe(ticket.title);
    expect(TicketUpsertSchema.safeParse(dto).success).toBe(true);
  });

  it('no envía campos de servidor (uuid, code, ownerUuid, createdAt, estado, SLA…)', () => {
    const keys = Object.keys(toTicketUpsert(ticket));
    expect(keys).not.toEqual(expect.arrayContaining(['uuid']));
    for (const serverKey of ['uuid', 'code', 'ownerUuid', 'createdAt', 'status', 'sla', 'nextStatuses', 'assigneeName']) {
      expect(keys).not.toContain(serverKey);
    }
  });

  it('un campo opcional ausente no viaja como undefined', () => {
    expect(Object.keys(toTicketUpsert(ticket))).not.toContain('otherCategoryDetail');
  });
});

describe('toAssigneeOptions («Asignado a»)', () => {
  const staff = [
    { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002', name: 'Ana Agente', email: 'ana@ticketit.dev', role: 'AGENT' },
    { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001', name: 'Marta Admin', email: 'marta@ticketit.dev', role: 'ADMIN' },
  ];

  it('«Sin asignar» (valor vacío) primero, y luego el personal con su correo', () => {
    expect(toAssigneeOptions(staff)).toEqual([
      { value: '', label: 'Sin asignar' },
      { value: 'ana@ticketit.dev', label: 'Ana Agente (ana@ticketit.dev)' },
      { value: 'marta@ticketit.dev', label: 'Marta Admin (marta@ticketit.dev)' },
    ]);
  });

  it('mientras el personal no ha cargado, el formulario sigue usable con «Sin asignar»', () => {
    expect(toAssigneeOptions([])).toEqual([{ value: '', label: 'Sin asignar' }]);
  });

  it('un responsable que ya no está en la lista se conserva (no se pierde en silencio al guardar)', () => {
    const options = toAssigneeOptions(staff, 'antiguo@ticketit.dev');
    expect(options.at(-1)).toEqual({ value: 'antiguo@ticketit.dev', label: 'antiguo@ticketit.dev (fuera de la lista)' });
  });

  it('un responsable que SÍ está en la lista no se duplica', () => {
    expect(toAssigneeOptions(staff, 'ana@ticketit.dev')).toHaveLength(3);
  });

  it('un ticket sin responsable no agrega opciones extra', () => {
    expect(toAssigneeOptions(staff, '')).toHaveLength(3);
  });
});

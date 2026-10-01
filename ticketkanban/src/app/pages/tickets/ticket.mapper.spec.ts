import { TicketUpsertSchema } from './ticket.schema';
import { toTicketUpsert } from './ticket.mapper';
import type { TTicket } from './ticket.types';

const ticket: TTicket = {
  uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
  code: 'TCK-001',
  ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
  createdAt: new Date('2026-09-20T15:00:00Z'),
  title: 'El login con Google devuelve 500',
  description: 'Ocurre solo con cuentas de Workspace.',
  category: 'bug',
  priority: 'critical',
  status: 'in_progress',
  assigneeEmail: 'ana@ticketit.dev',
  estimateHours: 6,
  dueDate: new Date(2026, 9, 2),
  notifyReporter: true,
};

describe('toTicketUpsert (mover una tarjeta reenvía el ticket con un campo distinto)', () => {
  it('cambia solo lo pedido y deja pasar el contrato de PATCH', () => {
    const dto = toTicketUpsert(ticket, { status: 'done' });
    expect(dto.status).toBe('done');
    expect(dto.title).toBe(ticket.title);
    expect(TicketUpsertSchema.safeParse(dto).success).toBe(true);
  });

  it('no envía campos de servidor (uuid, code, ownerUuid, createdAt)', () => {
    const keys = Object.keys(toTicketUpsert(ticket));
    expect(keys).not.toEqual(expect.arrayContaining(['uuid']));
    for (const serverKey of ['uuid', 'code', 'ownerUuid', 'createdAt']) {
      expect(keys).not.toContain(serverKey);
    }
  });

  it('un campo opcional ausente no viaja como undefined', () => {
    expect(Object.keys(toTicketUpsert(ticket))).not.toContain('otherCategoryDetail');
  });
});

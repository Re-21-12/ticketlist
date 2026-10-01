import { TICKET_FORM } from '../../pages/tickets/ticket-form.config';
import { TicketUpsertSchema } from '../../pages/tickets/ticket.schema';
import { computeAutoSections } from './auto-sections.util';
import { isFieldRequired } from './zod-field.util';

describe('isFieldRequired', () => {
  const requiredKeys = TICKET_FORM.fields
    .filter((field) => isFieldRequired(TICKET_FORM.schema, field))
    .map((field) => field.key);

  it('deduce los obligatorios del schema Zod, sin state.required en la config', () => {
    expect(requiredKeys).toEqual(['title', 'category', 'priority', 'status']);
  });
});

describe('TicketUpsertSchema', () => {
  const valid = {
    title: 'Algo roto',
    description: '',
    category: 'bug',
    priority: 'low',
    status: 'todo',
    assigneeEmail: '',
    estimateHours: null,
    dueDate: null,
    notifyReporter: false,
  };

  it('exige el detalle cuando la categoría es "other" (regla cross-field del contrato)', () => {
    const result = TicketUpsertSchema.safeParse({ ...valid, category: 'other' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['otherCategoryDetail']);
  });

  it('reporta la regla cross-field aunque otro campo siga inválido (when)', () => {
    const result = TicketUpsertSchema.safeParse({ ...valid, title: '', category: 'other' });
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['title', 'otherCategoryDetail']));
  });

  it('interpreta la fecha ISO de JSON como fecha LOCAL (sin corrimiento de un día por UTC)', () => {
    const { dueDate } = TicketUpsertSchema.parse({ ...valid, dueDate: '2026-10-01' });
    expect([dueDate?.getFullYear(), dueDate?.getMonth(), dueDate?.getDate()]).toEqual([2026, 9, 1]);
  });
});

describe('computeAutoSections', () => {
  it('no agrupa formularios de 6 campos o menos', () => {
    expect(computeAutoSections(TICKET_FORM.fields.slice(0, 6))).toBeNull();
  });

  it('reparte balanceado: 9 campos → [5, 4]', () => {
    const sections = computeAutoSections(TICKET_FORM.fields.slice(0, 9));
    expect(sections?.map((s) => s.fieldKeys.length)).toEqual([5, 4]);
  });
});

import { randomUUID } from 'node:crypto';
import type { ITicketEvent } from './events/ticket-event.entity.js';
import type { TTicketStatus } from './lifecycle/ticket-lifecycle.js';
import { policyFor } from './sla/sla-policy.js';
import type { ITicketSurvey } from './surveys/ticket-survey.entity.js';
import type { TicketEntity } from './ticket.entity.js';

/** Token de inyección de los datos iniciales (los tres repositorios parten del MISMO conjunto). */
export const TICKETS_SEED = Symbol('TICKETS_SEED');

const AUDIT = {
  id: 0,
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  isDeleted: false,
  restoredAt: null,
  restoredBy: null,
};

const USERS = {
  marta: { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001', name: 'Marta Admin', email: 'marta@ticketit.dev' },
  ana: { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002', name: 'Ana Agente', email: 'ana@ticketit.dev' },
  victor: { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000003', name: 'Víctor Lector', email: 'victor@ticketit.dev' },
  luis: { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004', name: 'Luis Agente', email: 'luis@ticketit.dev' },
  rosa: { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000006', name: 'Rosa Recursos Humanos', email: 'rosa@ticketit.dev' },
} as const;
type TPerson = keyof typeof USERS;

/** Departamento de origen de cada persona de la demostración (catálogo `ticket-department`). */
const DEPARTMENT_OF: Record<TPerson, string> = { rosa: 'hr', victor: 'sales', ana: 'it', luis: 'it', marta: 'it' };

export interface ITicketsSeed {
  tickets: TicketEntity[];
  events: ITicketEvent[];
  surveys: ITicketSurvey[];
}

type TStep =
  | { at: string; do: 'reply'; by?: 'staff' }
  | { at: string; do: 'internal' }
  | { at: string; do: 'customer-reply' }
  | { at: string; do: 'status'; to: TTicketStatus; by?: 'staff' | 'customer' | 'system'; note?: string };

/** Fecha local (UTC−6) `YYYY-MM-DD` + `HH:MM` → instante. */
const local = (day: string, time: string): Date => new Date(`${day}T${time}:00-06:00`);
const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);
const pad = (n: number): string => String(n).padStart(2, '0');
const dayKey = (date: Date): string => {
  const shifted = new Date(date.getTime() - 6 * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

/** El último día laborable (L–V) `n` días hábiles antes de `now`. */
function businessDayBefore(now: Date, n: number): string {
  let cursor = now;
  let remaining = n;
  while (remaining > 0) {
    cursor = addDays(cursor, -1);
    const weekday = new Date(cursor.getTime() - 6 * 3_600_000).getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return dayKey(cursor);
}

/** Los tres tickets de siempre (los usan los tests y los diccionarios): una muestra mínima y estable. */
function coreSeed(): ITicketsSeed {
  const make = (over: Partial<TicketEntity> & Pick<TicketEntity, 'uuid' | 'ownerUuid' | 'code' | 'title' | 'status' | 'createdAt'>): TicketEntity => {
    const priority = over.priority ?? 'medium';
    const type = over.type ?? 'service_request';
    const policy = policyFor(priority, type);
    return {
      ...AUDIT,
      description: '',
      type,
      category: 'other',
      department: 'it',
      complexity: null,
      otherCategoryDetail: null,
      priority,
      assigneeEmail: '',
      estimateHours: null,
      dueDate: null,
      notifyReporter: false,
      slaResponseMinutes: policy.responseMinutes,
      slaResolutionMinutes: policy.resolutionMinutes,
      resolution: null,
      resolvedAt: null,
      closedAt: null,
      ...over,
    };
  };

  const t1 = make({
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
    ownerUuid: USERS.ana.uuid,
    code: 'TCK-001',
    title: 'El login con Google devuelve 500',
    description: 'Ocurre solo con cuentas de Workspace.',
    type: 'incident',
    category: 'software',
    complexity: 'moderate',
    priority: 'critical',
    status: 'in_progress',
    assigneeEmail: USERS.ana.email,
    estimateHours: 6,
    dueDate: '2026-10-02',
    notifyReporter: true,
    createdAt: new Date('2026-09-20T15:00:00Z'),
  });
  const t2 = make({
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02',
    ownerUuid: USERS.marta.uuid,
    code: 'TCK-002',
    title: 'Exportar tablero a CSV',
    type: 'improvement',
    category: 'software',
    priority: 'medium',
    status: 'new',
    createdAt: new Date('2026-09-22T10:30:00Z'),
  });
  const closedAt = new Date('2026-09-18T20:00:00Z');
  const t3 = make({
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e03',
    ownerUuid: USERS.luis.uuid,
    code: 'TCK-003',
    title: 'Migrar dominio del correo de soporte',
    description: 'Cambio de proveedor SMTP.',
    type: 'service_request',
    category: 'other',
    complexity: 'simple',
    otherCategoryDetail: 'Infraestructura',
    priority: 'low',
    status: 'closed',
    assigneeEmail: USERS.luis.email,
    estimateHours: 3,
    dueDate: '2026-09-25',
    notifyReporter: true,
    resolution: 'Se migró el dominio y se verificaron SPF y DKIM.',
    resolvedAt: new Date('2026-09-18T18:00:00Z'),
    closedAt,
    createdAt: new Date('2026-09-18T14:00:00Z'),
  });

  const ev = (ticket: TicketEntity, partial: Partial<ITicketEvent> & Pick<ITicketEvent, 'type' | 'at' | 'actor'>): ITicketEvent => ({
    uuid: randomUUID(),
    ticketUuid: ticket.uuid,
    visibility: 'public',
    actorUuid: null,
    actorName: 'Sistema',
    from: null,
    body: null,
    attachments: [],
    assignee: null,
    ...partial,
  });

  const events: ITicketEvent[] = [
    ev(t1, { type: 'CREATED', at: t1.createdAt, actor: 'customer', actorName: USERS.ana.name, actorUuid: USERS.ana.uuid, status: 'assigned' }),
    ev(t1, { type: 'ASSIGNED', at: t1.createdAt, actor: 'staff', actorName: 'Sistema', assignee: USERS.ana.email }),
    ev(t1, { type: 'STATUS_CHANGED', at: new Date('2026-09-20T15:20:00Z'), actor: 'staff', actorName: USERS.ana.name, from: 'assigned', to: 'in_progress' }),
    ev(t2, { type: 'CREATED', at: t2.createdAt, actor: 'customer', actorName: USERS.marta.name, actorUuid: USERS.marta.uuid, status: 'new' }),
    ev(t3, { type: 'CREATED', at: t3.createdAt, actor: 'customer', actorName: USERS.luis.name, actorUuid: USERS.luis.uuid, status: 'assigned' }),
    ev(t3, { type: 'ASSIGNED', at: t3.createdAt, actor: 'staff', actorName: 'Sistema', assignee: USERS.luis.email }),
    ev(t3, { type: 'COMMENT_PUBLIC', at: new Date('2026-09-18T14:30:00Z'), actor: 'staff', actorName: USERS.luis.name, actorUuid: USERS.luis.uuid, body: 'Revisando el registro MX.' }),
    ev(t3, { type: 'STATUS_CHANGED', at: t3.resolvedAt as Date, actor: 'staff', actorName: USERS.luis.name, actorUuid: USERS.luis.uuid, from: 'assigned', to: 'resolved', body: t3.resolution }),
    ev(t3, { type: 'STATUS_CHANGED', at: closedAt, actor: 'customer', actorName: USERS.luis.name, actorUuid: USERS.luis.uuid, from: 'resolved', to: 'closed', by: 'customer' }),
  ];
  return { tickets: [t1, t2, t3], events, surveys: [] };
}

interface IDemoRow {
  owner: TPerson;
  assignee: 'ana' | 'luis' | null;
  /** Tipo de caso de la demostración: se traduce a (tipo, categoría) con `KINDS`. */
  kind: 'bug' | 'support' | 'feature';
  priority: TicketEntity['priority'];
  title: string;
  /** Días hábiles hacia atrás desde hoy, y hora local de creación. */
  daysAgo: number;
  time: string;
  steps: TStep[];
  survey?: { score: number; comment?: string } | 'none';
}

const KINDS: Record<IDemoRow['kind'], Pick<TicketEntity, 'type' | 'category' | 'complexity'>> = {
  bug: { type: 'incident', category: 'software', complexity: 'moderate' },
  support: { type: 'service_request', category: 'access', complexity: 'simple' },
  feature: { type: 'improvement', category: 'software', complexity: 'complex' },
};

/** Escenarios variados para que las métricas tengan algo que mostrar (solo fuera de las pruebas). */
const DEMO_ROWS: IDemoRow[] = [
  { owner: 'victor', assignee: 'ana', kind: 'support', priority: 'medium', title: 'No puedo imprimir en la impresora del piso 2', daysAgo: 9, time: '09:00', steps: [{ at: '09:25', do: 'reply' }, { at: '10:00', do: 'status', to: 'resolved', note: 'Se reinstaló el controlador.' }, { at: '+1d 09:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 5, comment: 'Rapidísimo, gracias.' } },
  { owner: 'rosa', assignee: 'luis', kind: 'bug', priority: 'high', title: 'El sistema de nómina no abre en Edge', daysAgo: 9, time: '10:00', steps: [{ at: '10:40', do: 'reply' }, { at: '11:30', do: 'status', to: 'resolved', note: 'Se limpió la caché y se actualizó la extensión.' }, { at: '+1d 10:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 5 } },
  { owner: 'victor', assignee: 'ana', kind: 'support', priority: 'low', title: 'Solicitud de acceso a la carpeta compartida de ventas', daysAgo: 8, time: '14:00', steps: [{ at: '14:30', do: 'reply' }, { at: '15:00', do: 'status', to: 'resolved', note: 'Acceso concedido.' }, { at: '+1d 14:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 4 } },
  { owner: 'rosa', assignee: 'ana', kind: 'bug', priority: 'critical', title: 'Sistema de planilla caído para todo RR. HH.', daysAgo: 8, time: '09:00', steps: [{ at: '09:10', do: 'reply' }, { at: '09:30', do: 'status', to: 'in_progress' }, { at: '12:30', do: 'status', to: 'resolved', note: 'Se reinició el servicio de base de datos.' }, { at: '+1d 09:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 3, comment: 'Tardó más de lo esperado.' } },
  { owner: 'victor', assignee: 'luis', kind: 'feature', priority: 'low', title: 'Poder adjuntar varios archivos al ticket', daysAgo: 7, time: '11:00', steps: [{ at: '13:30', do: 'reply' }, { at: '16:00', do: 'status', to: 'resolved', note: 'Se registró como mejora para el siguiente ciclo.' }, { at: '+2d 09:00', do: 'status', to: 'closed', by: 'system' }], survey: 'none' },
  { owner: 'rosa', assignee: 'luis', kind: 'support', priority: 'medium', title: 'No llegan los correos de la lista de RR. HH.', daysAgo: 7, time: '09:30', steps: [{ at: '09:50', do: 'reply' }, { at: '10:20', do: 'status', to: 'pending_customer', note: 'Necesito el encabezado completo de un correo.' }, { at: '11:00', do: 'customer-reply' }, { at: '11:05', do: 'reply' }, { at: '12:00', do: 'status', to: 'resolved', note: 'Se corrigió el filtro de spam.' }, { at: '+1d 09:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 4 } },
  { owner: 'victor', assignee: 'ana', kind: 'bug', priority: 'high', title: 'La pantalla de reportes se queda cargando', daysAgo: 6, time: '08:30', steps: [{ at: '08:45', do: 'reply' }, { at: '11:00', do: 'status', to: 'resolved', note: 'Se aumentó el tiempo de espera de la consulta.' }, { at: '+1d 09:00', do: 'status', to: 'reopened', by: 'customer', note: 'Volvió a pasar hoy.' }, { at: '+1d 09:20', do: 'reply' }, { at: '+1d 11:00', do: 'status', to: 'resolved', note: 'Se optimizó el índice.' }, { at: '+2d 09:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 3 } },
  { owner: 'rosa', assignee: 'luis', kind: 'support', priority: 'medium', title: 'Cambio de contraseña del correo', daysAgo: 6, time: '15:00', steps: [{ at: '15:10', do: 'reply' }, { at: '15:20', do: 'status', to: 'resolved', note: 'Contraseña restablecida.' }, { at: '+1d 15:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 5 } },
  { owner: 'victor', assignee: 'luis', kind: 'bug', priority: 'high', title: 'El módulo de inventario falla al exportar', daysAgo: 5, time: '09:00', steps: [{ at: '09:30', do: 'reply' }, { at: '09:40', do: 'status', to: 'escalated', note: 'Requiere cambio en el código: pasa a N2.' }, { at: '+2d 10:00', do: 'status', to: 'resolved', note: 'N2 publicó la corrección.' }, { at: '+3d 09:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 4 } },
  { owner: 'rosa', assignee: 'ana', kind: 'bug', priority: 'high', title: 'El sistema de nómina no abre en Edge (otra vez)', daysAgo: 5, time: '10:30', steps: [{ at: '10:45', do: 'reply' }, { at: '11:30', do: 'status', to: 'resolved', note: 'Se aplicó la misma corrección de la vez anterior.' }, { at: '+1d 10:30', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 4 } },
  { owner: 'victor', assignee: 'ana', kind: 'support', priority: 'low', title: 'Instalar Office en la laptop nueva', daysAgo: 4, time: '13:00', steps: [{ at: '14:30', do: 'reply' }, { at: '16:30', do: 'status', to: 'resolved', note: 'Office instalado y activado.' }, { at: '+1d 13:00', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 5 } },
  { owner: 'rosa', assignee: 'luis', kind: 'support', priority: 'medium', title: 'VPN no conecta desde casa', daysAgo: 4, time: '09:15', steps: [{ at: '12:00', do: 'reply' }, { at: '15:00', do: 'status', to: 'resolved', note: 'Se renovó el certificado.' }, { at: '+1d 09:15', do: 'status', to: 'closed', by: 'customer' }], survey: { score: 2, comment: 'Respondieron muy tarde.' } },
  { owner: 'victor', assignee: 'ana', kind: 'bug', priority: 'medium', title: 'Los totales del reporte mensual no cuadran', daysAgo: 3, time: '09:00', steps: [{ at: '09:20', do: 'reply' }, { at: '09:40', do: 'status', to: 'in_progress' }, { at: '10:30', do: 'status', to: 'pending_customer', note: '¿Qué filtros usó?' }], survey: 'none' },
  { owner: 'rosa', assignee: 'luis', kind: 'support', priority: 'high', title: 'La nómina de la quincena no se genera', daysAgo: 2, time: '08:30', steps: [{ at: '08:50', do: 'reply' }, { at: '09:10', do: 'status', to: 'in_progress' }], survey: 'none' },
  { owner: 'victor', assignee: 'ana', kind: 'support', priority: 'medium', title: 'Solicitud de un segundo monitor', daysAgo: 2, time: '11:00', steps: [{ at: '11:30', do: 'reply' }, { at: '12:00', do: 'status', to: 'resolved', note: 'Monitor entregado en su escritorio.' }], survey: 'none' },
  { owner: 'rosa', assignee: null, kind: 'support', priority: 'low', title: 'Dudas sobre cómo usar la firma electrónica', daysAgo: 1, time: '10:00', steps: [], survey: 'none' },
  { owner: 'victor', assignee: 'luis', kind: 'bug', priority: 'critical', title: 'No se puede iniciar sesión en el ERP', daysAgo: 1, time: '09:00', steps: [], survey: 'none' },
  { owner: 'rosa', assignee: null, kind: 'feature', priority: 'low', title: 'Agregar modo oscuro al portal', daysAgo: 0, time: '08:30', steps: [], survey: 'none' },
];

/** Genera tickets de demostración a partir de `now`, con sus eventos y encuestas (nunca en las pruebas). */
function demoSeed(now: Date, firstNumber: number): ITicketsSeed {
  const tickets: TicketEntity[] = [];
  const events: ITicketEvent[] = [];
  const surveys: ITicketSurvey[] = [];

  DEMO_ROWS.forEach((row, index) => {
    const day = businessDayBefore(now, row.daysAgo);
    const createdAt = local(day, row.time);
    const owner = USERS[row.owner];
    const assignee = row.assignee ? USERS[row.assignee] : null;
    const policy = policyFor(row.priority, KINDS[row.kind].type);
    const uuid = `6f1d7c2a-8b1e-4c7a-9f0e-${String(100 + index).padStart(12, '0')}`;
    let status: TTicketStatus = assignee ? 'assigned' : 'new';
    let resolution: string | null = null;
    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;

    const base = (partial: Partial<ITicketEvent> & Pick<ITicketEvent, 'type' | 'at' | 'actor'>): ITicketEvent => ({
      uuid: randomUUID(),
      ticketUuid: uuid,
      visibility: 'public',
      actorUuid: null,
      actorName: 'Sistema',
      from: null,
      body: null,
      attachments: [],
      assignee: null,
      ...partial,
    });
    const staffName = assignee?.name ?? 'Sistema';
    const staffUuid = assignee?.uuid ?? null;

    events.push(base({ type: 'CREATED', at: createdAt, actor: 'customer', actorName: owner.name, actorUuid: owner.uuid, status }));
    if (assignee) events.push(base({ type: 'ASSIGNED', at: createdAt, actor: 'staff', assignee: assignee.email }));

    /** `HH:MM` ese mismo día, o `+Nd HH:MM` N días HÁBILES después. */
    const when = (spec: string): Date => {
      const match = /^\+(\d+)d (\d{2}:\d{2})$/.exec(spec);
      if (!match) return local(day, spec);
      let target = local(day, match[2] as string);
      let left = Number(match[1]);
      while (left > 0) {
        target = addDays(target, 1);
        const weekday = new Date(target.getTime() - 6 * 3_600_000).getUTCDay();
        if (weekday !== 0 && weekday !== 6) left -= 1;
      }
      return target;
    };

    for (const step of row.steps) {
      const at = when(step.at);
      if (at > now) continue; // no se inventa futuro
      if (step.do === 'reply') {
        events.push(base({ type: 'COMMENT_PUBLIC', at, actor: 'staff', actorName: staffName, actorUuid: staffUuid, body: 'Recibido, ya lo estoy revisando.' }));
      } else if (step.do === 'internal') {
        events.push(base({ type: 'COMMENT_INTERNAL', at, actor: 'staff', visibility: 'internal', actorName: staffName, actorUuid: staffUuid, body: 'Nota interna.' }));
      } else if (step.do === 'customer-reply') {
        events.push(base({ type: 'COMMENT_PUBLIC', at, actor: 'customer', actorName: owner.name, actorUuid: owner.uuid, body: 'Adjunto la información que pidieron.' }));
        status = 'in_progress';
        events.push(base({ type: 'STATUS_CHANGED', at, actor: 'system', from: 'pending_customer', to: 'in_progress', body: 'El solicitante respondió' }));
      } else {
        const by = step.by ?? 'staff';
        events.push(
          base({
            type: 'STATUS_CHANGED',
            at,
            actor: by,
            actorName: by === 'system' ? 'Sistema' : by === 'customer' ? owner.name : staffName,
            actorUuid: by === 'system' ? null : by === 'customer' ? owner.uuid : staffUuid,
            from: status,
            to: step.to,
            ...(step.to === 'closed' ? { by: by === 'customer' ? ('customer' as const) : ('system' as const) } : {}),
            body: step.note ?? null,
          }),
        );
        status = step.to;
        if (step.to === 'resolved') {
          resolution = step.note ?? null;
          resolvedAt = at;
          closedAt = null;
        }
        if (step.to === 'reopened') {
          resolvedAt = null;
          closedAt = null;
        }
        if (step.to === 'closed') {
          closedAt = at;
          if (row.survey && row.survey !== 'none') {
            events.push(base({ type: 'SURVEY_SENT', at, actor: 'system' }));
            surveys.push({
              ticketUuid: uuid,
              requesterUuid: owner.uuid,
              assigneeEmail: assignee?.email ?? null,
              sentAt: at,
              expiresAt: new Date(at.getTime() + 7 * 86_400_000),
              answeredAt: new Date(at.getTime() + 3_600_000),
              score: row.survey.score,
              comment: row.survey.comment ?? null,
            });
            events.push(base({ type: 'SURVEY_ANSWERED', at: new Date(at.getTime() + 3_600_000), actor: 'customer', actorName: owner.name, actorUuid: owner.uuid, body: row.survey.comment ?? null }));
          }
        }
      }
    }

    tickets.push({
      ...AUDIT,
      uuid,
      ownerUuid: owner.uuid,
      code: `TCK-${String(firstNumber + index).padStart(3, '0')}`,
      title: row.title,
      description: '',
      ...KINDS[row.kind],
      // De dónde viene la solicitud: Rosa es de Recursos Humanos, Víctor de Ventas; el resto de TI (interno).
      department: DEPARTMENT_OF[row.owner],
      otherCategoryDetail: null,
      priority: row.priority,
      status,
      assigneeEmail: assignee?.email ?? '',
      estimateHours: null,
      dueDate: null,
      notifyReporter: true,
      slaResponseMinutes: policy.responseMinutes,
      slaResolutionMinutes: policy.resolutionMinutes,
      resolution,
      resolvedAt,
      closedAt,
      createdAt,
    });
  });
  return { tickets, events, surveys };
}

/**
 * Datos iniciales. Siempre los tres tickets de siempre; fuera de las pruebas, además tickets de
 * demostración (con historial y encuestas) para que el panel de métricas tenga algo que mostrar.
 */
export function buildTicketsSeed(options: { demo: boolean; now?: Date }): ITicketsSeed {
  const core = coreSeed();
  if (!options.demo) return core;
  const demo = demoSeed(options.now ?? new Date(), core.tickets.length + 1);
  return { tickets: [...core.tickets, ...demo.tickets], events: [...core.events, ...demo.events], surveys: [...core.surveys, ...demo.surveys] };
}

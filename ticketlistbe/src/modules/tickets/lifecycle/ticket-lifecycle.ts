/**
 * Ciclo de vida del ticket (docs/standard/metrics.md §2). Módulo PURO: sin Nest ni base de datos, así
 * cada regla se prueba sola. Quién puede mover el ticket a cada estado lo decide `TRANSITIONS`; el
 * servicio solo lo consulta.
 */
export const TICKET_STATUS = [
  'new',
  'assigned',
  'in_progress',
  'pending_customer',
  'escalated',
  'resolved',
  'closed',
  'reopened',
] as const;
export type TTicketStatus = (typeof TICKET_STATUS)[number];

/**
 * Quién mueve el ticket (docs/standard/authorization.md §6). Roles distintos, poderes distintos:
 *  - `agent`      → soporte N1: atiende, pide información, resuelve (solo lo que tiene asignado).
 *  - `supervisor` → asigna, ESCALA y pide información; NO resuelve ni atiende.
 *  - `admin`      → todo.
 *  - `customer`   → el solicitante: confirma el cierre o reabre lo suyo.
 *  - `system`     → procesos automáticos (cierre a las 48 h, respuesta del cliente).
 * El auditor no mueve nada (solo lectura).
 */
export type TTransitionActor = 'agent' | 'supervisor' | 'admin' | 'customer' | 'system';

const TEAM: readonly TTransitionActor[] = ['agent', 'supervisor', 'admin'];
const WORK: readonly TTransitionActor[] = ['agent', 'admin'];
const ESCALATE: readonly TTransitionActor[] = ['supervisor', 'admin'];

export const TRANSITIONS: Record<TTicketStatus, Partial<Record<TTicketStatus, readonly TTransitionActor[]>>> = {
  new: { assigned: TEAM, in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE },
  assigned: { in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
  in_progress: { pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
  // El cliente que responde devuelve el ticket a «En atención» sin intervención del agente.
  pending_customer: { in_progress: ['agent', 'admin', 'system'], escalated: ESCALATE, resolved: WORK },
  // Lo escalado vuelve a N1 (el supervisor lo devuelve) o lo cierra N1 al documentar la solución de N2.
  escalated: { in_progress: TEAM, resolved: WORK },
  resolved: { closed: ['customer', 'system'], reopened: ['customer', 'agent', 'admin'] },
  // Reincidencia: se puede reabrir un cerrado dentro de `REOPEN_WINDOW_DAYS`.
  closed: { reopened: ['customer', 'agent', 'admin'] },
  reopened: { assigned: ['supervisor', 'admin'], in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
};

/** Los actores de roles de equipo cuentan como «personal» en las métricas y en el historial. */
export const isTeamActor = (actor: TTransitionActor): boolean => TEAM.includes(actor);

/** Actor del HISTORIAL (`customer`/`staff`/`system`): lo que usan las métricas, sin distinguir qué rol del equipo. */
export const eventActorOf = (actor: TTransitionActor): 'customer' | 'staff' | 'system' =>
  actor === 'customer' ? 'customer' : actor === 'system' ? 'system' : 'staff';

/** Días tras el cierre en que aún se acepta una reapertura por reincidencia (supuesto, metrics.md §9). */
export const REOPEN_WINDOW_DAYS = 7;
/** Horas sin respuesta del cliente tras «Resuelto» para cerrar automáticamente (historia A4). */
export const AUTO_CLOSE_AFTER_HOURS = 48;

/**
 * Los estados son VARIACIONES de tres grandes (el tablero muestra 3 columnas y la variación como insignia):
 *  - Nuevo       → Nuevo, Reabierto
 *  - En atención → Asignado, En atención, Escalado, Pendiente del cliente
 *  - Cerrado     → Resuelto, Cerrado
 */
export const STATUS_GROUPS = {
  new: ['new', 'reopened'],
  in_attention: ['assigned', 'in_progress', 'escalated', 'pending_customer'],
  closed: ['resolved', 'closed'],
} as const satisfies Record<string, readonly TTicketStatus[]>;
export type TStatusGroup = keyof typeof STATUS_GROUPS;
export const STATUS_GROUP_KEYS = Object.keys(STATUS_GROUPS) as TStatusGroup[];

export function groupOf(status: TTicketStatus): TStatusGroup {
  return STATUS_GROUP_KEYS.find((group) => (STATUS_GROUPS[group] as readonly TTicketStatus[]).includes(status)) as TStatusGroup;
}

/** Estados en los que el ticket sigue «abierto» (cuentan en el backlog y corren los plazos). */
export const OPEN_STATUSES: readonly TTicketStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'pending_customer',
  'escalated',
  'reopened',
];

/** Estados en los que el reloj de SLA está detenido (en pausa o ya terminó). */
export const CLOCK_STOPPED_STATUSES: readonly TTicketStatus[] = ['pending_customer', 'escalated', 'resolved', 'closed'];

export const isOpen = (status: TTicketStatus): boolean => OPEN_STATUSES.includes(status);

export function canTransition(from: TTicketStatus, to: TTicketStatus, actor: TTransitionActor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** Destinos que `actor` puede elegir desde `from` (para armar los botones de la pantalla). */
export function allowedTargets(from: TTicketStatus, actor: TTransitionActor): TTicketStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [TTicketStatus, readonly TTransitionActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([status]) => status);
}

/** Estado inicial según haya o no responsable al registrar el ticket. */
export const initialStatus = (hasAssignee: boolean): TTicketStatus => (hasAssignee ? 'assigned' : 'new');

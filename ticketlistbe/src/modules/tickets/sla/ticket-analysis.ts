import { REOPEN_WINDOW_DAYS, type TTicketStatus } from '../lifecycle/ticket-lifecycle.js';
import { addBusinessMinutes, businessMinutesBetween, DEFAULT_CALENDAR, type IBusinessCalendar, type IInterval } from './business-calendar.js';
import type { ISlaPolicy } from './sla-policy.js';

/**
 * Análisis de UN ticket a partir de su historial (docs/standard/metrics.md §3). Módulo PURO: recibe los
 * eventos y devuelve tiempos y veredictos; no lee nada de «el estado de ahora», así que dos consultas
 * con los mismos eventos dan el mismo número.
 */
export type TTicketEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STATUS_CHANGED'
  | 'COMMENT_PUBLIC'
  | 'COMMENT_INTERNAL'
  | 'SURVEY_SENT'
  | 'SURVEY_ANSWERED';

export interface ITicketEventFact {
  readonly type: TTicketEventType;
  readonly at: Date;
  /** Quién lo hizo: el solicitante, el personal, o el sistema (automático). */
  readonly actor: 'customer' | 'staff' | 'system';
  /** Solo `STATUS_CHANGED`: estados origen y destino. */
  readonly from?: TTicketStatus | null;
  readonly to?: TTicketStatus;
  /** Solo `STATUS_CHANGED` a `closed`: quién cerró. */
  readonly by?: 'customer' | 'system';
}

export type TDeadlineStatus = 'met' | 'breached' | 'pending';
export type TResolutionStatus = 'met' | 'breached' | 'running' | 'paused' | 'escalated';

export interface IFirstResponse {
  /** Minutos hábiles hasta la primera respuesta humana; `null` si aún no hay. */
  readonly minutes: number | null;
  readonly status: TDeadlineStatus;
  /** Cuándo vence el plazo de primera respuesta (horas hábiles desde el registro). */
  readonly dueAt: Date;
}

/** Un «ciclo»: desde que se creó (o se reabrió) hasta que se resolvió. Cada uno tiene su propio plazo. */
export interface IResolutionCycle {
  readonly startedAt: Date;
  readonly resolvedAt: Date | null;
  /** Minutos hábiles en curso o hasta `resolvedAt`, SIN las pausas. */
  readonly minutes: number;
  readonly status: TResolutionStatus;
  /** Vencimiento del plazo (corrido por las pausas ya cerradas); `null` mientras está en pausa o si escaló. */
  readonly dueAt: Date | null;
}

export interface ITicketAnalysis {
  readonly firstResponse: IFirstResponse;
  readonly cycles: readonly IResolutionCycle[];
  readonly reopenCount: number;
  readonly escalated: boolean;
  /** Primera resolución (`null` si aún no se resuelve). */
  readonly firstResolvedAt: Date | null;
  /** `true` = resuelto al primer contacto; `false` = no; `null` = todavía no se resuelve. */
  readonly firstContact: boolean | null;
  readonly closedBy: 'customer' | 'system' | null;
  /** Cuándo se cerró por última vez (`null` si no está cerrado). */
  readonly closedAt: Date | null;
}

export interface IAnalysisInput {
  readonly createdAt: Date;
  readonly events: readonly ITicketEventFact[];
  readonly policy: ISlaPolicy;
  readonly now: Date;
  readonly calendar?: IBusinessCalendar;
}

const DAY_MS = 24 * 60 * 60_000;

export function analyzeTicket({ createdAt, events, policy, now, calendar = DEFAULT_CALENDAR }: IAnalysisInput): ITicketAnalysis {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const changes = sorted.filter((e) => e.type === 'STATUS_CHANGED');
  const reopens = changes.filter((e) => e.to === 'reopened');
  const escalation = changes.find((e) => e.to === 'escalated');
  // Un cierre posterior a una reapertura es el vigente: si el ticket se reabrió, ya no está cerrado.
  const lastChange = changes.at(-1);
  const lastClose = lastChange?.to === 'closed' ? lastChange : undefined;

  return {
    firstResponse: firstResponseOf(sorted, createdAt, policy, now, calendar),
    cycles: cyclesOf(createdAt, changes, policy, now, calendar),
    reopenCount: reopens.length,
    escalated: !!escalation,
    firstResolvedAt: changes.find((e) => e.to === 'resolved')?.at ?? null,
    firstContact: firstContactOf(sorted, changes, now),
    closedBy: lastClose?.by ?? null,
    closedAt: lastClose?.at ?? null,
  };
}

function firstResponseOf(
  events: readonly ITicketEventFact[],
  createdAt: Date,
  policy: ISlaPolicy,
  now: Date,
  calendar: IBusinessCalendar,
): IFirstResponse {
  // Un acuse automático NO cuenta: se necesita una persona del equipo.
  const reply = events.find((e) => e.type === 'COMMENT_PUBLIC' && e.actor === 'staff');
  const dueAt = addBusinessMinutes(createdAt, policy.responseMinutes, calendar);
  if (reply) {
    const minutes = businessMinutesBetween(createdAt, reply.at, calendar);
    return { minutes, status: minutes <= policy.responseMinutes ? 'met' : 'breached', dueAt };
  }
  // Sin respuesta todavía: si ya pasó el plazo es un incumplimiento, no se espera a que conteste.
  const waiting = businessMinutesBetween(createdAt, now, calendar);
  return { minutes: null, status: waiting > policy.responseMinutes ? 'breached' : 'pending', dueAt };
}

function cyclesOf(
  createdAt: Date,
  changes: readonly ITicketEventFact[],
  policy: ISlaPolicy,
  now: Date,
  calendar: IBusinessCalendar,
): IResolutionCycle[] {
  const cycles: IResolutionCycle[] = [];
  let startedAt = createdAt;
  let pauses: IInterval[] = [];
  let pausedSince: number | null = null;
  let escalated = false;
  let open = true;

  const closeCycle = (resolvedAt: Date | null): void => {
    const intervals = pausedSince === null ? pauses : [...pauses, { start: pausedSince, end: null }];
    const end = resolvedAt ?? now;
    const minutes = businessMinutesBetween(startedAt, end, calendar, intervals);
    const status: TResolutionStatus = escalated
      ? 'escalated'
      : resolvedAt
        ? minutes <= policy.resolutionMinutes
          ? 'met'
          : 'breached'
        : minutes > policy.resolutionMinutes
          ? 'breached'
          : pausedSince !== null
            ? 'paused'
            : 'running';
    const dueAt = escalated || pausedSince !== null ? null : addBusinessMinutes(startedAt, policy.resolutionMinutes, calendar, pauses);
    cycles.push({ startedAt, resolvedAt, minutes, status, dueAt });
  };

  for (const change of changes) {
    if (!open && change.to !== 'reopened') continue;
    if (pausedSince !== null && change.to !== 'pending_customer') {
      pauses = [...pauses, { start: pausedSince, end: change.at.getTime() }];
      pausedSince = null;
    }
    switch (change.to) {
      case 'pending_customer':
        pausedSince ??= change.at.getTime();
        break;
      case 'escalated':
        escalated = true;
        break;
      case 'resolved':
        closeCycle(change.at);
        open = false;
        break;
      case 'reopened':
        startedAt = change.at;
        pauses = [];
        pausedSince = null;
        escalated = false;
        open = true;
        break;
      default:
        break;
    }
  }
  if (open) closeCycle(null);
  return cycles;
}

/**
 * Resuelto al primer contacto (§3.3): resuelto con a lo sumo UNA respuesta pública del personal, sin
 * pedirle datos al cliente, sin escalar y sin reabrirse dentro de los 7 días. `null` si aún no se resuelve.
 */
function firstContactOf(
  events: readonly ITicketEventFact[],
  changes: readonly ITicketEventFact[],
  now: Date,
): boolean | null {
  const resolved = changes.find((e) => e.to === 'resolved');
  if (!resolved) return null;
  const before = (e: ITicketEventFact): boolean => e.at.getTime() <= resolved.at.getTime();
  const contacts = events.filter((e) => e.type === 'COMMENT_PUBLIC' && e.actor === 'staff' && before(e)).length;
  const askedCustomer = changes.some((e) => e.to === 'pending_customer' && before(e));
  const escalatedBefore = changes.some((e) => e.to === 'escalated' && before(e));
  const reopenedSoon = changes.some(
    (e) => e.to === 'reopened' && e.at.getTime() - resolved.at.getTime() <= REOPEN_WINDOW_DAYS * DAY_MS,
  );
  // Aún dentro de la ventana de 7 días, sin reapertura todavía: cuenta (si luego se reabre, deja de contar).
  void now;
  return contacts <= 1 && !askedCustomer && !escalatedBefore && !reopenedSoon;
}

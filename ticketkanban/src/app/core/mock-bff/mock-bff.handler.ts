import { HttpErrorResponse, HttpHeaders, HttpResponse, type HttpRequest } from '@angular/common/http';
import { createMongoAbility, subject } from '@casl/ability';
import { delay, of, throwError, type Observable } from 'rxjs';
import type { z } from 'zod';
import { environment } from '../../../environments/environment';
import { ChangePasswordFormSchema } from '../../pages/profile/profile.schema';
import type { IProblemDetails, IProblemFieldError } from '../interfaces/problem-details.interface';
import {
  TicketBaseSchema,
  TicketCreateSchema,
  TicketUpsertSchema,
} from '../../pages/tickets/ticket.schema';
import { TICKET_STATUS, toLocalIsoDate } from '../../pages/tickets/ticket.schema';
import { TICKET_STATUS_LABELS } from '../../pages/tickets/ticket.constants';
import { AVATAR_COLORS, AVATAR_ICONS } from '../ui/user-avatar/avatar.const';
import { MOCK_SHELLS, MOCK_TICKETS } from './mock-bff.data';

const LATENCY_MS = 500;
const TICKET_ITEM = /^\/api\/tickets\/([\w-]+)(\/restore)?$/;

/** Estado en memoria del mock (se reinicia al recargar la página). */
type TStoredTicket = (typeof MOCK_TICKETS)[number];
type TMockShell = (typeof MOCK_SHELLS)[keyof typeof MOCK_SHELLS];
/** `session` = lo que en el backend vive en el store de express-session (cookie `sid`). */
const db: {
  tickets: TStoredTicket[];
  session: TMockShell | null;
  password: string;
  sessions: IMockSession[];
  notifications: IMockNotification[];
} = {
  tickets: [...MOCK_TICKETS],
  session: null,
  password: environment.devSignIn?.password ?? '',
  sessions: [],
  notifications: [],
};

/** Vuelve el mock a su estado inicial (tickets, sesión, contraseña…). Lo usan los tests: el estado es del módulo y persistiría entre ellos. */
export function resetMockBff(): void {
  db.tickets = [...MOCK_TICKETS];
  db.session = null;
  db.password = environment.devSignIn?.password ?? '';
  db.sessions = [];
  db.notifications = [];
}

/** Sesión del mock (en el backend vive en Redis/memoria). `id` es opaco, como el hash del backend. */
interface IMockSession {
  id: string;
  current: boolean;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string | null;
}
interface IMockNotification {
  uuid: string;
  type: 'TICKET_ASSIGNED' | 'TICKET_CHANGED_BY_ALTERNANTE' | 'RELATIONSHIP_GRANTED' | 'RELATIONSHIP_REVOKED';
  message: string;
  resourceType: 'Ticket' | 'Relationship' | null;
  resourceUuid: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Handler del BFF falso (lo carga lazy `mockBffInterceptor`). Responde los MISMOS endpoints, con la
 * misma sesión (sign-in/sign-out, 401 sin sesión) y el MISMO Problem Details que el backend real
 * (ver ticketlistbe/src/common/filters), valida con los
 * mismos schemas Zod y autoriza con las mismas reglas CASL. Quitarlo de `app.config.ts` cuando el
 * backend esté arriba (y apuntar `/api` con proxy.conf).
 *
 * Fallo simulado: un título que contenga «error» responde 422, para probar el modal que queda
 * abierto y el toast del `errorInterceptor`.
 */
export function handleMockBff(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const url = new URL(req.urlWithParams, 'http://mock');

  if (req.method === 'POST' && url.pathname === '/api/auth/sign-in') return signIn(req);
  if (req.method === 'POST' && url.pathname === '/api/auth/sign-out') {
    db.session = null;
    db.sessions = [];
    return ok(null, 204);
  }
  // Todo lo demás es privado, igual que `SessionAuthGuard`.
  if (!db.session) return fail(req, 401, 'SAUT-E002', 'Debes iniciar sesión');

  if (req.method === 'GET' && url.pathname === '/api/bff/shell') return ok(db.session);
  if (req.method === 'GET' && url.pathname === '/api/bff/board') {
    return ok({
      columns: TICKET_STATUS.map((status) => ({
        status,
        label: TICKET_STATUS_LABELS[status],
        tickets: db.tickets.filter((t) => t.status === status),
      })),
    });
  }
  const profile = handleProfile(req, url);
  if (profile) return profile;

  if (url.pathname === '/api/tickets') {
    if (req.method === 'GET') return listTickets(url);
    if (req.method === 'POST') return createTicket(req);
  }
  const match = TICKET_ITEM.exec(url.pathname);
  if (match) return ticketItem(req, match[1], !!match[2]);

  return fail(req, 404, 'NEST-E404', 'Recurso no encontrado');
}

/** Mismas credenciales que ticketlistbe: usuarios sembrados + contraseña de desarrollo. */
function signIn(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  const shell = Object.values(MOCK_SHELLS).find((s) => s.user.email === email?.toLowerCase());
  if (!shell || !environment.devSignIn || password !== db.password) {
    return fail(req, 401, 'SAUT-E004', 'Correo o contraseña incorrectos');
  }
  db.session = structuredClone(shell);
  db.sessions = seedSessions();
  db.notifications = seedNotifications();
  return ok(db.session);
}

const SESSION_ID = /^\/api\/auth\/sessions\/([\w-]+)$/;
const NOTIFICATION_READ = /^\/api\/notifications\/([\w-]+)\/read$/;

function seedSessions(): IMockSession[] {
  const now = Date.now();
  return [
    {
      id: 'sesion-actual-0001',
      current: true,
      ipAddress: '127.0.0.1',
      userAgent: navigator.userAgent,
      createdAt: new Date(now - 5 * 60_000).toISOString(),
      expiresAt: new Date(now + 30 * 60_000).toISOString(),
    },
    {
      id: 'sesion-otra-00002',
      current: false,
      ipAddress: '192.168.1.24',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
      createdAt: new Date(now - 3 * 3_600_000).toISOString(),
      expiresAt: new Date(now + 12 * 60_000).toISOString(),
    },
  ];
}

function seedNotifications(): IMockNotification[] {
  const now = Date.now();
  return [
    {
      uuid: '5e1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
      type: 'TICKET_ASSIGNED',
      message: 'Te asignaron el ticket TCK-001',
      resourceType: 'Ticket',
      resourceUuid: MOCK_TICKETS[0].uuid,
      readAt: null,
      createdAt: new Date(now - 20 * 60_000).toISOString(),
    },
    {
      uuid: '5e1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02',
      type: 'RELATIONSHIP_GRANTED',
      message: 'Marta Admin te compartió sus tickets',
      resourceType: 'Relationship',
      resourceUuid: null,
      readAt: new Date(now - 3_600_000).toISOString(),
      createdAt: new Date(now - 26 * 3_600_000).toISOString(),
    },
  ];
}

/** Perfil: contraseña, sesiones, avatar y notificaciones. `null` = esta ruta no es del perfil. */
function handleProfile(req: HttpRequest<unknown>, url: URL): Observable<HttpResponse<unknown>> | null {
  const { pathname } = url;
  const session = db.session;
  if (!session) return null;

  if (req.method === 'PATCH' && pathname === '/api/auth/password') return changePassword(req);

  if (req.method === 'GET' && pathname === '/api/auth/sessions') return ok({ data: db.sessions });
  if (req.method === 'POST' && pathname === '/api/auth/sessions/revoke-others') {
    db.sessions = db.sessions.filter((s) => s.current);
    return ok(null, 204);
  }
  const sessionMatch = SESSION_ID.exec(pathname);
  if (req.method === 'DELETE' && sessionMatch) {
    const target = db.sessions.find((s) => s.id === sessionMatch[1]);
    if (!target) return fail(req, 404, 'RSES-E001', 'Sesión no encontrada');
    if (target.current) return fail(req, 422, 'SSES-E001', 'Para cerrar la sesión actual usa «Cerrar sesión»');
    db.sessions = db.sessions.filter((s) => s.id !== target.id);
    return ok(null, 204);
  }

  if (req.method === 'PATCH' && pathname === '/api/users/me/avatar') return updateAvatar(req, session);

  if (req.method === 'GET' && pathname === '/api/notifications') {
    return ok({ data: db.notifications, unread: db.notifications.filter((n) => !n.readAt).length });
  }
  const readMatch = NOTIFICATION_READ.exec(pathname);
  if (req.method === 'PATCH' && readMatch) {
    const notification = db.notifications.find((n) => n.uuid === readMatch[1]);
    if (!notification) return fail(req, 404, 'RNTF-E001', 'Notificación no encontrada');
    notification.readAt = new Date().toISOString();
    return ok(notification);
  }
  return null;
}

/** Mismas reglas que `AccountSecurityService`: actual incorrecta → 422, igual a la actual → 422. */
function changePassword(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const body = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
  // El backend valida solo estos dos campos (`strictObject`); el formulario agrega `confirmPassword`.
  const parsed = ChangePasswordFormSchema.safeParse({ ...body, confirmPassword: body.newPassword });
  if (!parsed.success) return invalid(req, parsed.error);
  if (body.currentPassword !== db.password) {
    return fail(req, 422, 'SAUT-E006', 'La contraseña actual no es correcta');
  }
  if (body.newPassword === body.currentPassword) {
    return fail(req, 422, 'SAUT-E007', 'La nueva contraseña debe ser distinta de la actual');
  }
  db.password = body.newPassword as string;
  db.sessions = db.sessions.filter((s) => s.current);
  return ok(null, 204);
}

function updateAvatar(req: HttpRequest<unknown>, session: TMockShell): Observable<HttpResponse<unknown>> {
  const body = (req.body ?? {}) as { avatarIcon?: string | null; avatarColor?: string | null };
  const icons: readonly (string | null)[] = [...AVATAR_ICONS, null];
  const colors: readonly (string | null)[] = [...AVATAR_COLORS, null];
  const errors = [
    ...(icons.includes(body.avatarIcon ?? null) ? [] : [fieldError('avatarIcon', 'Selecciona un ícono')]),
    ...(colors.includes(body.avatarColor ?? null) ? [] : [fieldError('avatarColor', 'Selecciona un color')]),
  ];
  if (errors.length) return fail(req, 400, 'CVAL-E001', 'Datos inválidos', errors);
  session.user.avatarIcon = body.avatarIcon ?? null;
  session.user.avatarColor = body.avatarColor ?? null;
  return ok({ avatarIcon: session.user.avatarIcon, avatarColor: session.user.avatarColor });
}

function fieldError(path: string, message: string): IProblemFieldError {
  return { pointer: `#/${path}`, path, message, code: 'invalid_value' };
}

function listTickets(url: URL): Observable<HttpResponse<unknown>> {
  const page = Number(url.searchParams.get('page') ?? 1);
  const take = Number(url.searchParams.get('take') ?? 10);
  const search = (url.searchParams.get('search') ?? '').toLowerCase();
  const matches = db.tickets.filter(
    (t) =>
      !search ||
      [t.code, t.title, t.assigneeEmail].some((v) => String(v ?? '').toLowerCase().includes(search)),
  );
  const data = matches.slice((page - 1) * take, page * take);
  return ok({ data, meta: { total: matches.length, page, take } });
}

function createTicket(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  if (!ability().can('create', 'Ticket')) return forbidden(req);
  // Mismo schema que el backend: defaults para lo que el alta rápida no envía.
  const parsed = TicketCreateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, parsed.error);
  if (parsed.data.title.toLowerCase().includes('error')) return simulatedFailure(req);
  const ticket = {
    ...toJson(parsed.data),
    uuid: crypto.randomUUID(),
    code: `TCK-${String(db.tickets.length + 1).padStart(3, '0')}`,
    ownerUuid: db.session!.user.uuid,
    createdAt: new Date().toISOString(),
  };
  db.tickets = [...db.tickets, ticket as TStoredTicket];
  return ok(ticket, 201);
}

function ticketItem(
  req: HttpRequest<unknown>,
  uuid: string,
  isRestore: boolean,
): Observable<HttpResponse<unknown>> {
  const current = db.tickets.find((t) => t.uuid === uuid);
  if (!current) return fail(req, 404, 'RTCK-E001', 'Ticket no encontrado');
  if (req.method === 'GET' || req.method === 'HEAD') return ok(current);
  if (req.method === 'PATCH' && !isRestore) {
    // Misma regla con condiciones que el front: el agente solo edita lo asignado a él.
    if (!ability().can('update', subject('Ticket', { ...current }))) return forbidden(req);
    const parsed = TicketUpsertSchema.safeParse(req.body);
    if (!parsed.success) return invalid(req, parsed.error);
    if (parsed.data.title.toLowerCase().includes('error')) return simulatedFailure(req);
    const updated = { ...current, otherCategoryDetail: undefined, ...toJson(parsed.data) };
    db.tickets = db.tickets.map((t) => (t.uuid === uuid ? (updated as TStoredTicket) : t));
    return ok(updated);
  }
  if (req.method === 'DELETE') {
    if (!ability().can('delete', subject('Ticket', { ...current }))) return forbidden(req);
    db.tickets = db.tickets.filter((t) => t.uuid !== uuid);
    return ok(null, 204);
  }
  return fail(req, 405, 'NEST-E405', 'Método no permitido');
}

function ability() {
  return createMongoAbility(db.session?.abilityRules ?? []);
}

/** Serializa como lo haría `JSON.stringify` en el backend: fechas LOCALES a 'YYYY-MM-DD'. */
function toJson(dto: Partial<z.output<typeof TicketBaseSchema>>): Record<string, unknown> {
  const { dueDate, ...rest } = dto;
  if (!(dueDate instanceof Date)) return { ...rest, ...(dueDate === null ? { dueDate } : {}) };
  return { ...rest, dueDate: toLocalIsoDate(dueDate) };
}

function ok(body: unknown, status = 200): Observable<HttpResponse<unknown>> {
  return of(new HttpResponse({ status, body: structuredClone(body) })).pipe(delay(LATENCY_MS));
}

/** Mismo cuerpo que `CustomExceptionFilter` de ticketlistbe: RFC 9457 Problem Details. */
function fail(
  req: HttpRequest<unknown>,
  status: number,
  code: string,
  title: string,
  errors?: IProblemFieldError[],
): Observable<never> {
  const body: IProblemDetails = {
    type: `/api/problems/${code}`,
    title,
    status,
    ...(errors ? { detail: `${errors.length} campo(s) inválido(s)` } : {}),
    instance: req.url,
    code,
    timestamp: new Date().toISOString(),
    context: null,
    ...(errors ? { errors } : {}),
  };
  return throwError(
    () =>
      new HttpErrorResponse({
        status,
        url: req.url,
        error: body,
        headers: new HttpHeaders({ 'Content-Type': 'application/problem+json' }),
      }),
  ).pipe(delay(LATENCY_MS));
}

function invalid(req: HttpRequest<unknown>, error: z.ZodError): Observable<never> {
  const errors = error.issues.map((i) => ({
    pointer: `#/${i.path.map((p) => String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`,
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
  return fail(req, 400, 'CVAL-E001', 'Datos inválidos', errors);
}

function forbidden(req: HttpRequest<unknown>): Observable<never> {
  return fail(req, 403, 'SAUT-E001', 'No tienes permisos suficientes para esto');
}

function simulatedFailure(req: HttpRequest<unknown>): Observable<never> {
  return fail(req, 422, 'STCK-E999', 'El BFF rechazó el ticket (fallo simulado)');
}

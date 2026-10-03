import { HttpErrorResponse, HttpHeaders, HttpResponse, type HttpRequest } from '@angular/common/http';
import { createMongoAbility, subject } from '@casl/ability';
import { delay, of, tap, throwError, type Observable } from 'rxjs';
import type { z } from 'zod';
import { environment } from '../../../environments/environment';
import { EUserRole } from '../casl/ability.enum';
import { ResetPasswordFormSchema, SignUpFormSchema } from '../../pages/auth/auth.schema';
import { ChangePasswordFormSchema, TotpEnableFormSchema } from '../../pages/profile/profile.schema';
import { SurveyFormSchema } from '../../pages/tickets/ticket.schema';
import { RecoverWithPasswordFormSchema, RecoverWithTotpFormSchema } from '../../pages/auth/auth.schema';
import type { IProblemDetails, IProblemFieldError } from '../interfaces/problem-details.interface';
import {
  TicketBaseSchema,
  TicketCreateSchema,
  TicketUpsertSchema,
} from '../../pages/tickets/ticket.schema';
import { TicketTransitionSchema, toLocalIsoDate } from '../../pages/tickets/ticket.schema';
import { TICKET_GROUP_LABELS } from '../../pages/tickets/ticket.constants';
import { AVATAR_COLORS, AVATAR_ICONS } from '../ui/user-avatar/avatar.const';
import { buildShell, handleAdmin, isActiveCatalogCode, recordAudit, resetAdminState, type IMockHelpers } from './mock-bff.admin';
import { buildViewerShell, MOCK_SHELLS, MOCK_TICKETS, type IMockTicket } from './mock-bff.data';
import { mockAgentDetail, mockAgentsResponse, mockProblems, mockSummaryResponse, type IMockMetricsInput } from './mock-metrics';
import { mockRealtime$ } from './mock-realtime';
import { requesterMessage, type IMockEvent } from './mock-ticket-events';
import { MOCK_TRANSITIONS, mockActorsFor, mockIsTeamFor, mockNextStatuses, REOPEN_WINDOW_MS, type IMockViewer, type TMockActor } from './mock-ticket-lifecycle';

const LATENCY_MS = 500;

/** Espejo de `STATUS_GROUPS` (ticket-lifecycle.ts del backend): Nuevo · En atención · Cerrado. */
const STATUS_GROUPS = {
  new: ['new', 'reopened'],
  in_attention: ['assigned', 'in_progress', 'escalated', 'pending_customer'],
  closed: ['resolved', 'closed'],
} as const;
const TICKET_ITEM = /^\/api\/tickets\/([\w-]+)(\/restore)?$/;
const TICKET_TRANSITION = /^\/api\/tickets\/([\w-]+)\/transitions$/;
const TICKET_SURVEY = /^\/api\/tickets\/([\w-]+)\/survey$/;
const TICKET_EVENTS = /^\/api\/tickets\/([\w-]+)\/events$/;
const TICKET_COMMENTS = /^\/api\/tickets\/([\w-]+)\/comments$/;

/** Estado en memoria del mock (se reinicia al recargar la página). */
type TStoredTicket = IMockTicket;
type TMockShell = (typeof MOCK_SHELLS)[keyof typeof MOCK_SHELLS];
/** `session` = lo que en el backend vive en el store de express-session (cookie `sid`). */
/** Cuenta del mock (en el backend: `UsersRepository`). `verified` = ya confirmó su correo. */
interface IMockUser {
  email: string;
  name: string;
  password: string;
  verified: boolean;
  /** Cuenta deshabilitada por un administrador: no inicia sesión. */
  disabled: boolean;
  createdAt: string;
  shell: TMockShell;
  /** Autenticador: `pending` = secreto generado sin confirmar. Solo mock: el código válido es `MOCK_TOTP_CODE`. */
  totp: 'off' | 'pending' | 'on';
  /** Intentos fallidos seguidos de inicio de sesión; `lockedAt` ≠ null = bloqueada hasta que un administrador la desbloquee. */
  failedLogins: number;
  lockedAt: string | null;
}

/** Intentos fallidos seguidos que bloquean la cuenta (`LOGIN_MAX_ATTEMPTS` del backend). */
const MAX_FAILED_LOGINS = 5;

/** Código TOTP que acepta el mock (en el backend sale del secreto y el reloj, RFC 6238). */
export const MOCK_TOTP_CODE = '123456';

/** Token de un enlace de correo (en el backend vive HASHEADO en el almacén clave-valor). */
interface IMockToken {
  kind: 'verify' | 'reset';
  email: string;
}

function seedUsers(): IMockUser[] {
  const password = environment.devSignIn?.password ?? '';
  // Los usuarios sembrados nacen con el correo verificado (mismos que `users.seed.ts` del backend).
  const luis = structuredClone(MOCK_SHELLS[EUserRole.AGENT]);
  luis.user = { ...luis.user, uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004', name: 'Luis Agente', email: 'luis@ticketit.dev' };
  // Copias: el administrador cambia roles sobre estos objetos y las constantes del módulo no deben mutar.
  const rosa = structuredClone(MOCK_SHELLS[EUserRole.VIEWER]);
  rosa.user = { ...rosa.user, uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000006', name: 'Rosa Recursos Humanos', email: 'rosa@ticketit.dev' };
  return [...Object.values(MOCK_SHELLS).map((shell) => structuredClone(shell)), luis, rosa].map((shell) => ({
    email: shell.user.email,
    name: shell.user.name,
    password,
    verified: true,
    disabled: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    shell,
    totp: 'off' as const,
    failedLogins: 0,
    lockedAt: null,
  }));
}

const db: {
  tickets: TStoredTicket[];
  session: TMockShell | null;
  users: IMockUser[];
  tokens: Map<string, IMockToken>;
  sessions: IMockSession[];
  notifications: IMockNotification[];
  /** Encuestas respondidas por ticket. */
  surveys: Map<string, { score: number; comment: string | null }>;
  /** Historial de cada ticket (CU01): se siembra al consultarlo y crece con cada cambio. */
  events: IMockEvent[];
} = {
  tickets: [...MOCK_TICKETS],
  session: null,
  users: seedUsers(),
  tokens: new Map(),
  sessions: [],
  notifications: [],
  surveys: new Map(),
  events: [],
};

/** Vuelve el mock a su estado inicial. Lo usan los tests: el estado es del módulo y persistiría entre ellos. */
export function resetMockBff(): void {
  db.tickets = [...MOCK_TICKETS];
  db.session = null;
  db.users = seedUsers();
  db.tokens = new Map();
  db.sessions = [];
  db.notifications = [];
  db.surveys = new Map();
  db.events = [];
  resetAdminState();
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
  /** Quién la recibe; sin él, la ve cualquier sesión (las de demostración). */
  recipientUuid?: string;
  type:
    | 'TICKET_ASSIGNED'
    | 'TICKET_CHANGED_BY_ALTERNANTE'
    | 'RELATIONSHIP_GRANTED'
    | 'RELATIONSHIP_REVOKED'
    | 'TICKET_SURVEY'
    | 'TICKET_STATUS_CHANGED'
    | 'TICKET_COMMENTED'
    | 'TICKET_REOPENED'
    | 'ACCOUNT_LOCKED';
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
  const result$ = dispatch(req);
  if (req.method === 'GET' || req.method === 'HEAD') return result$;
  // Auditoría de TODA mutación (también las denegadas), como el `AuditMiddleware` del backend.
  const actorBefore = db.session?.user ?? null;
  return result$.pipe(
    tap({
      next: (response) => recordAudit({ req, status: response.status, actor: db.session?.user ?? actorBefore }),
      error: (error: { status?: number }) => recordAudit({ req, status: error.status ?? 500, actor: db.session?.user ?? actorBefore }),
    }),
  );
}

function dispatch(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const url = new URL(req.urlWithParams, 'http://mock');

  if (req.method === 'POST' && url.pathname === '/api/auth/sign-in') return signIn(req);
  if (req.method === 'POST' && url.pathname === '/api/auth/sign-out') {
    db.session = null;
    db.sessions = [];
    return ok(null, 204);
  }
  const publicAuth = handlePublicAuth(req, url);
  if (publicAuth) return publicAuth;

  // Todo lo demás es privado, igual que `SessionAuthGuard`.
  if (!db.session) return fail(req, 401, 'SAUT-E002', 'Debes iniciar sesión');

  if (req.method === 'GET' && url.pathname === '/api/bff/shell') {
    // Se reconstruye en cada carga, como el backend: un cambio de rol, permisos o menú rige desde aquí.
    const account = findUser(db.session.user.email);
    if (!account || account.disabled) {
      db.session = null;
      return fail(req, 401, 'SAUT-E002', 'Debes iniciar sesión');
    }
    db.session = buildShell(account.shell.user);
    return ok(db.session);
  }
  if (req.method === 'GET' && url.pathname === '/api/bff/board') {
    // Los estados son variaciones de tres columnas (mismo agrupamiento que `STATUS_GROUPS` del backend).
    return ok({
      columns: (Object.keys(STATUS_GROUPS) as (keyof typeof STATUS_GROUPS)[]).map((group) => ({
        group,
        label: TICKET_GROUP_LABELS[group],
        statuses: [...STATUS_GROUPS[group]],
        tickets: visibleTickets().filter((t) => (STATUS_GROUPS[group] as readonly string[]).includes(t.status)).map(present),
      })),
    });
  }
  const profile = handleProfile(req, url);
  if (profile) return profile;
  const admin = handleAdmin(req, url, adminHelpers);
  if (admin) return admin as Observable<HttpResponse<unknown>>;
  const metrics = handleMetrics(req, url);
  if (metrics) return metrics;

  if (url.pathname === '/api/tickets') {
    if (req.method === 'GET') return listTickets(url);
    if (req.method === 'POST') return createTicket(req);
  }
  const transition = TICKET_TRANSITION.exec(url.pathname);
  if (transition && req.method === 'POST') return transitionTicket(req, transition[1] as string);
  const survey = TICKET_SURVEY.exec(url.pathname);
  if (survey) return handleSurvey(req, survey[1] as string);
  const eventsMatch = TICKET_EVENTS.exec(url.pathname);
  if (eventsMatch && req.method === 'GET') return listTicketEvents(req, eventsMatch[1] as string);
  const commentsMatch = TICKET_COMMENTS.exec(url.pathname);
  if (commentsMatch && req.method === 'POST') return postComment(req, commentsMatch[1] as string);
  const match = TICKET_ITEM.exec(url.pathname);
  if (match) return ticketItem(req, match[1], !!match[2]);

  return fail(req, 404, 'NEST-E404', 'Recurso no encontrado');
}

const findUser = (email: string | undefined): IMockUser | undefined =>
  db.users.find((user) => user.email === email?.toLowerCase());

/** Mismas reglas que el backend: 401 genérico, y 403 `SAUT-E008` solo DESPUÉS de acertar la contraseña. */
function signIn(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  const user = findUser(email);
  // Cuenta bloqueada: ni se mira la contraseña; solo un administrador la desbloquea (CU07 A3).
  if (user?.lockedAt) return lockedResponse(req);
  // Una cuenta deshabilitada responde igual que una contraseña incorrecta (no se revela su estado).
  if (!user || user.disabled || user.password !== password) {
    if (user && !user.disabled && ++user.failedLogins >= MAX_FAILED_LOGINS) {
      user.lockedAt = new Date().toISOString();
      return lockedResponse(req);
    }
    return fail(req, 401, 'SAUT-E004', 'Correo o contraseña incorrectos');
  }
  user.failedLogins = 0;
  if (!user.verified) return fail(req, 403, 'SAUT-E008', 'Verifica tu correo antes de iniciar sesión');
  db.session = buildShell(user.shell.user);
  db.sessions = seedSessions();
  // Los avisos de demostración se reinician; los generados por cambios de tickets (con destinatario) se conservan.
  db.notifications = [...seedNotifications(), ...db.notifications.filter((n) => n.recipientUuid)];
  return ok(db.session);
}

/** 423 con la información de contacto de los administradores (a quién pedirle el desbloqueo). */
function lockedResponse(req: HttpRequest<unknown>): Observable<never> {
  const contacts = db.users.filter((u) => u.shell.user.role === EUserRole.ADMIN && !u.disabled).map((u) => ({ name: u.name, email: u.email }));
  return failWith(req, 423, 'SAUT-E014', 'Tu cuenta está bloqueada por demasiados intentos fallidos. Comunícate con un administrador para desbloquearla', { contacts });
}

// ── Alta de cuenta y recuperación (PÚBLICOS: no hay sesión todavía) ─────────────────────────────
const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

function issueToken(kind: IMockToken['kind'], email: string): string {
  const token = randomToken();
  db.tokens.set(token, { kind, email });
  const page = kind === 'verify' ? 'verify-email' : 'reset-password';
  return `${location.origin}/${page}?token=${token}`;
}

/** `devUrl` (el enlace del correo) solo se devuelve en desarrollo, como el backend fuera de producción. */
const accountReply = (message: string, devUrl?: string) =>
  ok({ message, ...(devUrl && !environment.production ? { devUrl } : {}) });

function handlePublicAuth(req: HttpRequest<unknown>, url: URL): Observable<HttpResponse<unknown>> | null {
  if (req.method !== 'POST') return null;
  const body = (req.body ?? {}) as Record<string, string | undefined>;
  switch (url.pathname) {
    case '/api/auth/sign-up': {
      const parsed = SignUpFormSchema.safeParse({ ...body, confirmPassword: body['password'] });
      if (!parsed.success) return invalid(req, parsed.error);
      if (findUser(parsed.data.email)) return fail(req, 409, 'SUSR-E001', 'Ya existe una cuenta con ese correo');
      const email = parsed.data.email.toLowerCase();
      db.users.push({
        email,
        name: parsed.data.name,
        password: parsed.data.password,
        verified: true, // sin confirmación por correo: la cuenta nace activa
        disabled: false,
        createdAt: new Date().toISOString(),
        shell: buildViewerShell(parsed.data.name, email),
        totp: 'off',
        failedLogins: 0,
        lockedAt: null,
      });
      return accountReply('Cuenta creada. Ya puedes iniciar sesión.');
    }
    case '/api/auth/verify-email': {
      const entry = body['token'] ? db.tokens.get(body['token']) : undefined;
      const user = entry?.kind === 'verify' ? findUser(entry.email) : undefined;
      if (!entry || !user) return fail(req, 400, 'SAUT-E009', 'El enlace no es válido o ya venció');
      db.tokens.delete(body['token'] as string); // un solo uso
      user.verified = true;
      return ok(null, 204);
    }
    case '/api/auth/resend-verification': {
      const user = findUser(body['email']);
      const link = user && !user.verified ? issueToken('verify', user.email) : undefined;
      return accountReply('Si la cuenta existe y falta verificarla, te enviamos un nuevo enlace.', link);
    }
    case '/api/auth/forgot-password': {
      const user = findUser(body['email']);
      const link = user ? issueToken('reset', user.email) : undefined;
      // Misma respuesta exista o no la cuenta (anti-enumeración).
      return accountReply('Si el correo existe, te enviamos un enlace para restablecer tu contraseña.', link);
    }
    case '/api/auth/recover-password': {
      // Misma respuesta (401 SAUT-E010) para cualquier fallo: cuenta inexistente, sin autenticador, código o clave mal.
      const method = body['method'];
      const user = findUser(body['email']);
      const checked =
        method === 'totp'
          ? RecoverWithTotpFormSchema.safeParse({ email: body['email'], code: body['code'], newPassword: body['newPassword'], confirmPassword: body['newPassword'] })
          : method === 'current_password'
            ? RecoverWithPasswordFormSchema.safeParse({ email: body['email'], currentPassword: body['currentPassword'], newPassword: body['newPassword'], confirmPassword: body['newPassword'] })
            : null;
      if (!checked) return fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('method', 'Método de recuperación desconocido')]);
      if (!checked.success) return invalid(req, checked.error);
      const verified =
        !!user &&
        !user.disabled &&
        (method === 'totp' ? user.totp === 'on' && body['code'] === MOCK_TOTP_CODE : user.password === body['currentPassword']);
      if (!verified || !user || user.lockedAt) return fail(req, 401, 'SAUT-E010', 'Los datos de verificación no son correctos');
      if (method === 'current_password' && body['newPassword'] === user.password) {
        return fail(req, 422, 'SAUT-E007', 'La nueva contraseña debe ser distinta de la actual');
      }
      user.password = body['newPassword'] as string;
      if (db.session?.user.email === user.email) db.session = null; // se cierran todas sus sesiones
      return ok(null, 204);
    }
    case '/api/auth/reset-password': {
      const parsed = ResetPasswordFormSchema.safeParse({
        newPassword: body['newPassword'],
        confirmPassword: body['newPassword'],
      });
      if (!parsed.success) return invalid(req, parsed.error);
      const entry = body['token'] ? db.tokens.get(body['token']) : undefined;
      const user = entry?.kind === 'reset' ? findUser(entry.email) : undefined;
      if (!entry || !user) return fail(req, 400, 'SAUT-E009', 'El enlace no es válido o ya venció');
      db.tokens.delete(body['token'] as string);
      user.password = parsed.data.newPassword;
      user.verified = true; // restablecer prueba que controla el correo
      if (db.session?.user.email === user.email) db.session = null; // se cierran todas sus sesiones
      return ok(null, 204);
    }
    default:
      return null;
  }
}

/** Mismos usuarios sembrados que `users.seed.ts` del backend (los ADMIN/AGENT, por nombre). */
const MOCK_ASSIGNABLE = [
  { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002', name: 'Ana Agente', email: 'ana@ticketit.dev', role: 'AGENT' },
  { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004', name: 'Luis Agente', email: 'luis@ticketit.dev', role: 'AGENT' },
  { uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001', name: 'Marta Admin', email: 'marta@ticketit.dev', role: 'ADMIN' },
];

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

  // Autenticador (TOTP): mismos códigos de error que el backend.
  if (pathname.startsWith('/api/auth/totp')) return handleTotp(req, pathname);

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

  // Personal asignable: igual que el backend (verificado y ADMIN/AGENT), por nombre y SIN datos de más.
  if (req.method === 'GET' && pathname === '/api/users/assignable') return ok({ data: MOCK_ASSIGNABLE });

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const mine = db.notifications.filter((n) => !n.recipientUuid || n.recipientUuid === session.user.uuid);
    const data = [...mine, ...derivedNotifications(session.user.uuid)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ data, unread: data.filter((n) => !n.readAt).length });
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

function handleTotp(req: HttpRequest<unknown>, pathname: string): Observable<HttpResponse<unknown>> {
  const account = findUser(db.session?.user.email);
  if (!account) return fail(req, 401, 'SAUT-E002', 'Necesitas iniciar sesión');
  if (req.method === 'GET' && pathname === '/api/auth/totp') return ok({ enabled: account.totp === 'on' });
  const body = (req.body ?? {}) as { code?: string; currentPassword?: string };
  if (req.method === 'POST' && pathname === '/api/auth/totp/setup') {
    if (account.totp === 'on') return fail(req, 409, 'SAUT-E013', 'El autenticador ya está activado');
    account.totp = 'pending';
    return ok({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', otpauthUrl: `otpauth://totp/Ticketit:${account.email}?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Ticketit` });
  }
  if (req.method === 'POST' && pathname === '/api/auth/totp/enable') {
    const parsed = TotpEnableFormSchema.safeParse(body);
    if (!parsed.success) return invalid(req, parsed.error);
    if (account.totp !== 'pending') return fail(req, 409, 'SAUT-E012', 'No hay una configuración del autenticador en curso');
    if (body.code !== MOCK_TOTP_CODE) return fail(req, 422, 'SAUT-E011', 'El código del autenticador no es correcto');
    account.totp = 'on';
    return ok(null, 204);
  }
  if (req.method === 'POST' && pathname === '/api/auth/totp/disable') {
    if (body.currentPassword !== account.password) return fail(req, 422, 'SAUT-E006', 'La contraseña actual no es correcta');
    account.totp = 'off';
    return ok(null, 204);
  }
  return fail(req, 405, 'NEST-E405', 'Método no permitido');
}

/**
 * Avisos que el backend crea por los EVENTOS: al cerrarse un ticket, quien lo solicitó recibe la encuesta de
 * satisfacción (si no la respondió); y a la administración le llega cada cuenta bloqueada.
 */
function derivedNotifications(userUuid: string): IMockNotification[] {
  const surveys = db.tickets
    .filter((t) => t.status === 'closed' && t.ownerUuid === userUuid && !db.surveys.has(t.uuid))
    .map<IMockNotification>((t) => ({
      uuid: `5e5e5e5e-0000-4000-8000-${t.uuid.slice(-12)}`,
      type: 'TICKET_SURVEY',
      message: `¿Cómo te atendimos en ${t.code}? Tu opinión es opcional`,
      resourceType: 'Ticket',
      resourceUuid: t.uuid,
      readAt: null,
      createdAt: t.closedAt ?? new Date().toISOString(),
    }));
  const isAdmin = db.session?.user.role === EUserRole.ADMIN;
  const locked = isAdmin
    ? db.users
        .filter((u) => u.lockedAt)
        .map<IMockNotification>((u) => ({
          uuid: `5e5e5e5e-1111-4000-8000-${u.shell.user.uuid.slice(-12)}`,
          type: 'ACCOUNT_LOCKED',
          message: `La cuenta ${u.email} se bloqueó por intentos fallidos de inicio de sesión. Desbloquéala en Usuarios si se comunicó contigo`,
          resourceType: null,
          resourceUuid: null,
          readAt: null,
          createdAt: u.lockedAt as string,
        }))
    : [];
  return [...surveys, ...locked];
}

/** Encuesta de satisfacción (CSAT 1–5): solo quien solicitó el ticket y solo cuando está cerrado; una respuesta por ticket. */
function handleSurvey(req: HttpRequest<unknown>, uuid: string): Observable<HttpResponse<unknown>> {
  const ticket = db.tickets.find((t) => t.uuid === uuid);
  const me = db.session?.user.uuid;
  if (!ticket || ticket.ownerUuid !== me || ticket.status !== 'closed') return fail(req, 404, 'SSRV-E001', 'No hay encuesta disponible para este ticket');
  const answered = db.surveys.get(uuid);
  const expiresAt = new Date(new Date(ticket.closedAt ?? Date.now()).getTime() + 7 * 86_400_000).toISOString();
  const state = (): { state: string; expiresAt: string; score: number | null; comment: string | null } => ({
    state: answered ? 'answered' : Date.now() > new Date(expiresAt).getTime() ? 'expired' : 'pending',
    expiresAt,
    score: answered?.score ?? null,
    comment: answered?.comment ?? null,
  });
  if (req.method === 'GET') return ok(state());
  if (req.method !== 'POST') return fail(req, 405, 'NEST-E405', 'Método no permitido');
  const parsed = SurveyFormSchema.safeParse({ score: (req.body as Record<string, unknown>)?.['score'], comment: (req.body as Record<string, unknown>)?.['comment'] ?? '' });
  if (!parsed.success) return invalid(req, parsed.error);
  if (answered) return fail(req, 409, 'SSRV-E002', 'La encuesta ya fue respondida');
  if (state().state === 'expired') return fail(req, 410, 'SSRV-E003', 'La encuesta venció');
  db.surveys.set(uuid, { score: parsed.data.score, comment: parsed.data.comment || null });
  return ok({ state: 'answered', expiresAt, score: parsed.data.score, comment: parsed.data.comment || null });
}

/** Mismas reglas que `AccountSecurityService`: actual incorrecta → 422, igual a la actual → 422. */
function changePassword(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  const body = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
  // El backend valida solo estos dos campos (`strictObject`); el formulario agrega `confirmPassword`.
  const parsed = ChangePasswordFormSchema.safeParse({ ...body, confirmPassword: body.newPassword });
  if (!parsed.success) return invalid(req, parsed.error);
  const account = findUser(db.session?.user.email);
  if (!account || body.currentPassword !== account.password) {
    return fail(req, 422, 'SAUT-E006', 'La contraseña actual no es correcta');
  }
  if (body.newPassword === body.currentPassword) {
    return fail(req, 422, 'SAUT-E007', 'La nueva contraseña debe ser distinta de la actual');
  }
  account.password = body.newPassword as string;
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

/** Lo que el administrador del mock (`mock-bff.admin.ts`) toma prestado de este handler. */
const adminHelpers: IMockHelpers = {
  ok,
  fail,
  invalid,
  forbidden,
  can: (action, subjectName) => ability().can(action, subjectName as never),
  accounts: () => db.users,
  endSessionOf: (email) => {
    if (db.session?.user.email === email) db.session = null;
  },
  currentEmail: () => db.session?.user.email ?? null,
};

function fieldError(path: string, message: string): IProblemFieldError {
  return { pointer: `#/${path}`, path, message, code: 'invalid_value' };
}

// ── Métricas (solo lectura, `/api/metrics/*`) ─────────────────────────────────────────────────────
const METRICS_PATH = /^\/api\/metrics\/(summary|agents|problems|me)(?:\/([^/]+))?$/;

/** Período de la consulta: `from`/`to` como fecha o fecha-hora ISO; sin ellos, los últimos 30 días. Mismas reglas que el backend. */
function metricsInput(req: HttpRequest<unknown>, url: URL): IMockMetricsInput | Observable<never> {
  const now = new Date();
  const rawFrom = url.searchParams.get('from');
  const rawTo = url.searchParams.get('to');
  const dateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const parse = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
  if ((rawFrom && !parse(rawFrom)) || (rawTo && !parse(rawTo))) return fail(req, 400, 'CVAL-E001', 'Datos inválidos');
  const to = rawTo ? new Date((parse(rawTo) as Date).getTime() + (dateOnly(rawTo) ? 86_400_000 - 1 : 0)) : now;
  const from = rawFrom ? (parse(rawFrom) as Date) : new Date(to.getTime() - 30 * 86_400_000);
  if (from > to) return fail(req, 400, 'CVAL-E001', 'Datos inválidos');
  if ((to.getTime() - from.getTime()) / 86_400_000 > 366) return fail(req, 400, 'CVAL-E001', 'Datos inválidos');
  return {
    tickets: db.tickets,
    surveys: db.surveys,
    agentEmails: db.users.filter((u) => u.shell.user.role === EUserRole.AGENT && !u.disabled).map((u) => u.email),
    nameOf: (email) => accountName(email) ?? email,
    ownerName: (uuid) => db.users.find((u) => u.shell.user.uuid === uuid)?.name ?? 'Cuenta desconocida',
    from,
    to,
    now,
  };
}

function handleMetrics(req: HttpRequest<unknown>, url: URL): Observable<HttpResponse<unknown>> | null {
  const match = METRICS_PATH.exec(url.pathname);
  if (!match) return null;
  if (req.method !== 'GET') return fail(req, 405, 'NEST-E405', 'Método no permitido');
  const [, kind, email] = match;
  // El equipo ve todo con `read Metric`; cada persona ve solo lo suyo con `read MyMetric` (igual que el backend).
  if (!ability().can('read', kind === 'me' ? 'MyMetric' : 'Metric')) return forbidden(req);
  const input = metricsInput(req, url);
  if ('subscribe' in input) return input as Observable<never>;
  if (kind === 'summary') return ok(mockSummaryResponse(input));
  if (kind === 'problems') return ok(mockProblems(input));
  if (kind === 'me') return ok(mockAgentDetail(db.session?.user.email ?? '', input));
  if (kind === 'agents') return email ? ok(mockAgentDetail(decodeURIComponent(email).toLowerCase(), input)) : ok(mockAgentsResponse(input));
  return null;
}

// ── Tickets ────────────────────────────────────────────────────────────────────────────────────
/** Minutos de SLA por prioridad (espejo de `sla-policy.ts`; las mejoras bajas, 48 h). */
const SLA_RESOLUTION: Record<IMockTicket['priority'], number> = { critical: 120, high: 480, medium: 480, low: 1440 };
const SLA_RESPONSE = 120;

const viewer = (): IMockViewer | null => {
  const user = db.session?.user;
  return user ? { uuid: user.uuid, email: user.email, role: user.role } : null;
};

/** Solo lo que la sesión puede LEER (el cliente ve lo suyo): igual que `readableRowFilter` del backend. */
const visibleTickets = (): TStoredTicket[] =>
  db.tickets.filter((t) => ability().can('read', subject('Ticket', { ...t })));

const accountName = (email: string): string | null => (email ? (findUser(email)?.name ?? email) : null);

/** El ticket tal como lo devuelve el backend: lo guardado + lo derivado (SLA, quién atiende, `nextStatuses`). */
function present(t: TStoredTicket) {
  const created = new Date(t.createdAt).getTime();
  const resolutionMinutes = SLA_RESOLUTION[t.priority] * (t.priority === 'low' && t.type === 'improvement' ? 2 : 1);
  const done = t.status === 'resolved' || t.status === 'closed';
  const owner = db.users.find((u) => u.shell.user.uuid === t.ownerUuid);
  return {
    ...t,
    attendedSince: t.status === 'assigned' || t.status === 'in_progress' ? (t.attendedSince ?? t.createdAt) : null,
    requesterName: owner?.name ?? 'Cuenta desconocida',
    assigneeName: accountName(t.assigneeEmail),
    sla: {
      responseMinutes: SLA_RESPONSE,
      resolutionMinutes,
      responseStatus: t.status === 'new' ? 'pending' : 'met',
      resolutionStatus:
        t.status === 'escalated'
          ? 'escalated'
          : t.status === 'pending_customer'
            ? 'paused'
            : done
              ? 'met'
              : // Vencido el plazo sin resolver: fuera de SLA (el backend lo calcula con el calendario hábil).
                Date.now() > created + resolutionMinutes * 60_000
                ? 'breached'
                : 'running',
      responseDueAt: new Date(created + SLA_RESPONSE * 60_000).toISOString(),
      resolutionDueAt:
        t.status === 'escalated' || t.status === 'pending_customer' ? null : new Date(created + resolutionMinutes * 60_000).toISOString(),
    },
    nextStatuses: mockNextStatuses(t, viewer()),
  };
}

function listTickets(url: URL): Observable<HttpResponse<unknown>> {
  const page = Number(url.searchParams.get('page') ?? 1);
  const take = Number(url.searchParams.get('take') ?? 10);
  const search = (url.searchParams.get('search') ?? '').toLowerCase();
  // Mismos filtros que `GET /api/tickets` del backend.
  const only = (key: 'status' | 'priority' | 'type' | 'category' | 'department') => url.searchParams.get(key);
  // «Mis tickets» (CU01): solo los que registró quien consulta.
  const mine = url.searchParams.get('mine') === 'true' ? db.session?.user.uuid : null;
  const matches = visibleTickets().filter(
    (t) =>
      (!mine || t.ownerUuid === mine) &&
      (!search || [t.code, t.title, t.assigneeEmail].some((v) => String(v ?? '').toLowerCase().includes(search))) &&
      (['status', 'priority', 'type', 'category', 'department'] as const).every((key) => !only(key) || t[key] === only(key)),
  );
  const data = matches.slice((page - 1) * take, page * take).map(present);
  return ok({ data, meta: { total: matches.length, page, take } });
}

function createTicket(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  if (!ability().can('create', 'Ticket')) return forbidden(req);
  // Mismo schema que el backend: defaults para lo que el alta rápida no envía.
  const parsed = TicketCreateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, parsed.error);
  if (parsed.data.title.toLowerCase().includes('error')) return simulatedFailure(req);
  // El departamento debe ser un elemento activo del catálogo (los administra la organización).
  if (!isActiveCatalogCode('ticket-department', parsed.data.department)) return fail(req, 422, 'STCK-E007', 'Ese departamento no existe o no está disponible');
  // Quien solo es solicitante (cliente) clasifica su caso, pero no asigna, ni estima, ni fija la complejidad.
  const team = viewerIsTeam();
  const assigneeEmail = team ? parsed.data.assigneeEmail : '';
  const ticket: TStoredTicket = {
    ...(toJson(parsed.data) as Omit<
      TStoredTicket,
      'uuid' | 'code' | 'ownerUuid' | 'status' | 'resolution' | 'resolvedAt' | 'closedAt' | 'reopenCount' | 'createdAt' | 'attendedSince'
    >),
    assigneeEmail,
    complexity: team ? (parsed.data.complexity ?? null) : null,
    estimateHours: team ? parsed.data.estimateHours : null,
    dueDate: team ? ((toJson(parsed.data)['dueDate'] as string | null | undefined) ?? null) : null,
    uuid: crypto.randomUUID(),
    code: `TCK-${String(db.tickets.length + 1).padStart(3, '0')}`,
    ownerUuid: db.session!.user.uuid,
    // Nace «Asignado» si ya trae responsable, «Nuevo» si no.
    status: assigneeEmail ? 'assigned' : 'new',
    attendedSince: assigneeEmail ? new Date().toISOString() : null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    createdAt: new Date().toISOString(),
  };
  db.tickets = [...db.tickets, ticket];
  recordEvent(ticket, { type: 'CREATED', actor: 'customer' });
  return ok(present(ticket), 201);
}

/** ¿La sesión es del equipo (administrador, supervisor, agente)? Un cliente o auditor no asigna ni estima. */
function viewerIsTeam(): boolean {
  const role = db.session?.user.role;
  return role === EUserRole.ADMIN || role === EUserRole.SUPERVISOR || role === EUserRole.AGENT;
}

function ticketItem(
  req: HttpRequest<unknown>,
  uuid: string,
  isRestore: boolean,
): Observable<HttpResponse<unknown>> {
  const current = visibleTickets().find((t) => t.uuid === uuid);
  // Inexistente O no legible: el mismo 404 (no se revela que existe).
  if (!current) return fail(req, 404, 'RTCK-E001', 'Ticket no encontrado');
  if (req.method === 'GET' || req.method === 'HEAD') return ok(present(current));
  if (req.method === 'PATCH' && !isRestore) {
    // Misma regla con condiciones que el front: el agente solo edita lo asignado a él.
    if (!ability().can('update', subject('Ticket', { ...current }))) return forbidden(req);
    const parsed = TicketUpsertSchema.safeParse(req.body);
    if (!parsed.success) return invalid(req, parsed.error);
    if (parsed.data.title.toLowerCase().includes('error')) return simulatedFailure(req);
    // Solo se revalida si CAMBIA: un departamento desactivado después no impide editar tickets viejos.
    if (parsed.data.department !== current.department && !isActiveCatalogCode('ticket-department', parsed.data.department)) {
      return fail(req, 422, 'STCK-E007', 'Ese departamento no existe o no está disponible');
    }
    const changes = toJson(parsed.data) as Partial<TStoredTicket>;
    // El solicitante edita SU caso; responsable, estimación, fecha y complejidad son del equipo: si quien edita no
    // es equipo en este ticket, esos campos se conservan.
    const team = mockIsTeamFor(current, viewer());
    const assigneeEmail = team ? (changes.assigneeEmail ?? '') : current.assigneeEmail;
    // Un «Nuevo» al que se le pone responsable pasa a «Asignado».
    const status = current.status === 'new' && !current.assigneeEmail && assigneeEmail ? 'assigned' : current.status;
    const updated: TStoredTicket = {
      ...current,
      otherCategoryDetail: undefined,
      ...changes,
      assigneeEmail,
      complexity: team && changes.complexity !== undefined ? changes.complexity : current.complexity,
      estimateHours: team ? (changes.estimateHours ?? null) : current.estimateHours,
      dueDate: team ? (changes.dueDate ?? null) : current.dueDate,
      status,
      attendedSince: status === 'assigned' && current.status !== 'assigned' ? new Date().toISOString() : current.attendedSince,
    };
    db.tickets = db.tickets.map((t) => (t.uuid === uuid ? updated : t));
    if (updated.assigneeEmail && updated.assigneeEmail !== current.assigneeEmail) onAssigned(current, updated);
    return ok(present(updated));
  }
  if (req.method === 'DELETE') {
    if (!ability().can('delete', subject('Ticket', { ...current }))) return forbidden(req);
    db.tickets = db.tickets.filter((t) => t.uuid !== uuid);
    return ok(null, 204);
  }
  return fail(req, 405, 'NEST-E405', 'Método no permitido');
}

/** `POST /api/tickets/:uuid/transitions`: mismas reglas que `TicketLifecycleService.transition`. */
function transitionTicket(req: HttpRequest<unknown>, uuid: string): Observable<HttpResponse<unknown>> {
  const current = visibleTickets().find((t) => t.uuid === uuid);
  if (!current) return fail(req, 404, 'RTCK-E001', 'Ticket no encontrado');
  const parsed = TicketTransitionSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, parsed.error);
  const actors = mockActorsFor(current, viewer());
  if (actors.size === 0) return forbidden(req);

  const { to } = parsed.data;
  const actor = ([...actors] as TMockActor[]).find((candidate) => MOCK_TRANSITIONS[current.status][to]?.includes(candidate));
  if (!actor) return fail(req, 409, 'STCK-E001', 'El ticket no puede pasar a ese estado');
  if (current.status === 'closed' && to === 'reopened' && Date.now() - new Date(current.closedAt ?? 0).getTime() > REOPEN_WINDOW_MS) {
    return fail(req, 409, 'STCK-E004', 'Venció el plazo para reabrir el ticket; registra uno nuevo');
  }

  const now = new Date().toISOString();
  const updated: TStoredTicket = {
    ...current,
    status: to,
    ...(to === 'resolved' ? { resolution: parsed.data.resolution ?? null, resolvedAt: now, closedAt: null } : {}),
    ...(to === 'closed' ? { closedAt: now } : {}),
    ...(to === 'reopened' ? { resolvedAt: null, closedAt: null, reopenCount: current.reopenCount + 1 } : {}),
    // El reloj de la tarjeta arranca al entrar a «Asignado» o «En atención».
    ...(to === 'assigned' || to === 'in_progress' ? { attendedSince: now } : {}),
  };
  db.tickets = db.tickets.map((t) => (t.uuid === uuid ? updated : t));
  recordEvent(updated, { type: 'STATUS_CHANGED', actor: actor === 'customer' ? 'customer' : actor === 'system' ? 'system' : 'staff', from: current.status, to, body: parsed.data.note ?? parsed.data.resolution ?? null });
  const message = requesterMessage(updated.code, to, { teamActor: actor === 'agent' || actor === 'supervisor' || actor === 'admin', system: actor === 'system' });
  if (message) notifyRequester(updated, message);
  return ok(present(updated));
}

// ── Historial y avisos del ticket (CU01) ──────────────────────────────────────────────────────────
// Los eventos se siembran al consultarlos (los tres tickets de siempre no traen historial) y crecen con cada cambio.
type TEventInput = { type: IMockEvent['type']; actor: IMockEvent['actor']; from?: IMockEvent['from']; to?: IMockEvent['to']; body?: string | null; assignee?: string | null; visibility?: IMockEvent['visibility']; at?: string };

function recordEvent(ticket: TStoredTicket, input: TEventInput): IMockEvent {
  const sessionUser = db.session?.user;
  const event: IMockEvent = {
    uuid: crypto.randomUUID(),
    ticketUuid: ticket.uuid,
    type: input.type,
    at: input.at ?? new Date().toISOString(),
    visibility: input.visibility ?? 'public',
    actor: input.actor,
    actorName: input.actor === 'system' ? 'Sistema' : (sessionUser?.name ?? 'Sistema'),
    from: input.from ?? null,
    to: input.to ?? null,
    body: input.body ?? null,
    attachments: [],
    assignee: input.assignee ?? null,
  };
  db.events = [...db.events, event];
  return event;
}

function eventsOfTicket(ticket: TStoredTicket): IMockEvent[] {
  if (!db.events.some((e) => e.ticketUuid === ticket.uuid)) {
    const owner = db.users.find((u) => u.shell.user.uuid === ticket.ownerUuid)?.name ?? 'Cuenta desconocida';
    const seed = (e: Omit<IMockEvent, 'uuid' | 'ticketUuid' | 'attachments' | 'visibility' | 'from' | 'to' | 'body' | 'assignee'> & Partial<IMockEvent>): IMockEvent => ({ uuid: crypto.randomUUID(), ticketUuid: ticket.uuid, attachments: [], visibility: 'public', from: null, to: null, body: null, assignee: null, ...e });
    const seeded: IMockEvent[] = [seed({ type: 'CREATED', actor: 'customer', actorName: owner, at: ticket.createdAt })];
    if (ticket.assigneeEmail) seeded.push(seed({ type: 'ASSIGNED', actor: 'staff', actorName: 'Supervisor', at: ticket.attendedSince ?? ticket.createdAt, assignee: ticket.assigneeEmail }));
    if (ticket.status === 'in_progress') seeded.push(seed({ type: 'STATUS_CHANGED', actor: 'staff', actorName: accountName(ticket.assigneeEmail) ?? 'Equipo', at: ticket.attendedSince ?? ticket.createdAt, from: 'assigned', to: 'in_progress' }));
    if (ticket.resolvedAt) seeded.push(seed({ type: 'STATUS_CHANGED', actor: 'staff', actorName: accountName(ticket.assigneeEmail) ?? 'Equipo', at: ticket.resolvedAt, from: 'in_progress', to: 'resolved', body: ticket.resolution }));
    if (ticket.closedAt) seeded.push(seed({ type: 'STATUS_CHANGED', actor: 'customer', actorName: owner, at: ticket.closedAt, from: 'resolved', to: 'closed' }));
    db.events = [...db.events, ...seeded];
  }
  return db.events.filter((e) => e.ticketUuid === ticket.uuid).sort((a, b) => a.at.localeCompare(b.at));
}

/** Crea la notificación, la publica en tiempo real y la deja en el historial del ticket. Quien la provoca no se avisa a sí mismo. */
function notifyUser(recipientUuid: string, type: IMockNotification['type'], message: string, ticket: TStoredTicket): IMockNotification | null {
  if (db.session?.user.uuid === recipientUuid) return null;
  const notification: IMockNotification = { uuid: crypto.randomUUID(), recipientUuid, type, message, resourceType: 'Ticket', resourceUuid: ticket.uuid, readAt: null, createdAt: new Date().toISOString() };
  db.notifications = [notification, ...db.notifications];
  mockRealtime$.next({ recipientUuid, notification: structuredClone(notification) });
  return notification;
}

/** Avisa al SOLICITANTE de un cambio y deja constancia en el historial (evento `NOTIFIED`): postcondición de CU01. */
function notifyRequester(ticket: TStoredTicket, message: string): void {
  if (!notifyUser(ticket.ownerUuid, 'TICKET_STATUS_CHANGED', message, ticket)) return;
  recordEvent(ticket, { type: 'NOTIFIED', actor: 'system', body: message });
}

function onAssigned(before: TStoredTicket, after: TStoredTicket): void {
  const assignee = findUser(after.assigneeEmail);
  recordEvent(after, { type: 'ASSIGNED', actor: 'staff', assignee: after.assigneeEmail, body: before.assigneeEmail ? `Antes: ${before.assigneeEmail}` : null });
  if (assignee) notifyUser(assignee.shell.user.uuid, 'TICKET_ASSIGNED', `Te asignaron ${after.code} «${after.title}»`, after);
  notifyRequester(after, `${assignee?.name ?? after.assigneeEmail} atenderá tu solicitud ${after.code}`);
}

function listTicketEvents(req: HttpRequest<unknown>, uuid: string): Observable<HttpResponse<unknown>> {
  const ticket = visibleTickets().find((t) => t.uuid === uuid);
  if (!ticket) return fail(req, 404, 'RTCK-E001', 'Ticket no encontrado');
  const team = viewerIsTeam() || db.session?.user.role === EUserRole.AUDITOR;
  return ok({ data: eventsOfTicket(ticket).filter((e) => team || e.visibility === 'public') });
}

/** `POST /api/tickets/:uuid/comments`: el solicitante comenta en público; el equipo también puede dejar notas internas. */
function postComment(req: HttpRequest<unknown>, uuid: string): Observable<HttpResponse<unknown>> {
  const ticket = visibleTickets().find((t) => t.uuid === uuid);
  if (!ticket) return fail(req, 404, 'RTCK-E001', 'Ticket no encontrado');
  const actors = mockActorsFor(ticket, viewer());
  if (actors.size === 0) return forbidden(req);
  if (ticket.status === 'closed') return fail(req, 409, 'STCK-E003', 'El ticket está cerrado: ya no admite comentarios');
  const body = String(((req.body ?? {}) as { body?: unknown }).body ?? '').trim();
  const internal = !!((req.body ?? {}) as { internal?: unknown }).internal;
  if (body.length < 1 || body.length > 2000) return fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('body', 'El comentario debe tener entre 1 y 2000 caracteres')]);
  const team = mockIsTeamFor(ticket, viewer());
  if (internal && !team) return forbidden(req);
  const event = recordEvent(ticket, { type: internal ? 'COMMENT_INTERNAL' : 'COMMENT_PUBLIC', actor: team ? 'staff' : 'customer', visibility: internal ? 'internal' : 'public', body });
  // El solicitante que responde a «Pendiente del cliente» devuelve el ticket a «En atención».
  if (!team && ticket.status === 'pending_customer') {
    const resumed: TStoredTicket = { ...ticket, status: 'in_progress' };
    db.tickets = db.tickets.map((t) => (t.uuid === uuid ? resumed : t));
    recordEvent(resumed, { type: 'STATUS_CHANGED', actor: 'system', from: 'pending_customer', to: 'in_progress', body: 'El solicitante respondió' });
  }
  if (!internal) {
    const name = db.session?.user.name ?? 'Alguien';
    if (team) notifyUser(ticket.ownerUuid, 'TICKET_COMMENTED', `${name} respondió en ${ticket.code}`, ticket);
    else {
      const assignee = ticket.assigneeEmail ? findUser(ticket.assigneeEmail) : null;
      if (assignee) notifyUser(assignee.shell.user.uuid, 'TICKET_COMMENTED', `${name} comentó en ${ticket.code}`, ticket);
    }
  }
  return ok(event, 201);
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
  return failWith(req, status, code, title, null, errors);
}

function failWith(
  req: HttpRequest<unknown>,
  status: number,
  code: string,
  title: string,
  context: Record<string, unknown> | null,
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
    context,
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

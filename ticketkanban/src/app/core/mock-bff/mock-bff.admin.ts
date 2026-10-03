import type { HttpRequest, HttpResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { z } from 'zod';
import { EAbility, EUserRole } from '../casl/ability.enum';
import type { TBadgeSeverity } from '../../shared/ui/badge/badge.types';
import type { TConditionPreset } from '../casl/casl-labels.constants';
import type { TSubjects } from '../casl/casl.types';
import { MenuItemUpsertSchema } from '../../pages/menu-items/menu-item.schema';
import { RolePermissionUpsertSchema } from '../../pages/role-permissions/role-permission.schema';
import {
  CatalogCreateSchema,
  CatalogItemUpsertSchema,
  CatalogUpdateSchema,
} from '../../pages/catalogs/catalog.schema';
import { GrantsFormSchema } from '../../pages/sharing/relationship.schema';
import type { ShellSchema } from '../session/session.schema';
import type { IProblemFieldError } from '../interfaces/problem-details.interface';

type TShell = z.input<typeof ShellSchema>;
type TRule = TShell['abilityRules'][number];
type TMenuEntry = TShell['menu'][number];
type TResponse$ = Observable<HttpResponse<unknown>>;

/** Lo que el administrador del mock necesita saber de una cuenta (la define `mock-bff.handler`). */
export interface IAdminAccount {
  email: string;
  name: string;
  verified: boolean;
  disabled: boolean;
  /** Bloqueada por intentos fallidos de inicio de sesión (solo un administrador la desbloquea). */
  lockedAt: string | null;
  failedLogins: number;
  createdAt: string;
  shell: { user: TShell['user'] };
}

/** Servicios del handler principal (respuestas, errores, permisos) que el administrador reutiliza. */
export interface IMockHelpers {
  ok(body: unknown, status?: number): TResponse$;
  fail(req: HttpRequest<unknown>, status: number, code: string, title: string, errors?: IProblemFieldError[]): Observable<never>;
  invalid(req: HttpRequest<unknown>, error: z.ZodError): Observable<never>;
  forbidden(req: HttpRequest<unknown>): Observable<never>;
  can(action: string, subject: string): boolean;
  accounts(): IAdminAccount[];
  /** Cierra la sesión del mock si es la de esa cuenta. */
  endSessionOf(email: string): void;
  currentEmail(): string | null;
}

// ── Datos sembrados (espejo de los seeds del backend) ───────────────────────────────────────────
interface IRule {
  uuid: string;
  role: EUserRole;
  subject: TSubjects;
  action: EAbility;
  condition: TConditionPreset;
  createdAt: string;
}
interface IMenuItem {
  uuid: string;
  key: string;
  label: string;
  route: string;
  group: string | null;
  icon: string | null;
  subject: TSubjects | null;
  requiredAction: EAbility | null;
  order: number;
  active: boolean;
  createdAt: string;
}
interface ICatalog {
  key: string;
  name: string;
  description: string;
  system: boolean;
}
interface ICatalogItem {
  uuid: string;
  catalogKey: string;
  code: string;
  label: string;
  order: number;
  active: boolean;
  system: boolean;
  icon: string | null;
  severity: TBadgeSeverity | null;
}
interface IGrant {
  objectType: 'Ticket';
  canRead: boolean;
  canUpdate: boolean;
  notifyTitular: boolean;
  consentVersion: string;
  consentedAt: string;
}
interface IRelationship {
  uuid: string;
  titularUuid: string;
  alternanteUuid: string;
  alternanteEmail: string;
  status: 'ACTIVE' | 'REVOKED';
  grants: IGrant[];
  endedAt: string | null;
  createdAt: string;
}
interface IAuditEntry {
  uuid: string;
  at: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SIGN_IN' | 'SIGN_OUT';
  subject: string;
  route: string;
  method: string;
  resourceUuid: string | null;
  status: number;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  actorUuid: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  ip: string;
  userAgent: string;
  requestId: string | null;
  changedFields: string[];
}

const SEED_AT = '2026-09-01T00:00:00.000Z';
const CONSENT_VERSION = '2026-09-29';

function seedRules(): IRule[] {
  const rows: [EUserRole, TSubjects, EAbility, TConditionPreset][] = [
    [EUserRole.ADMIN, 'all', EAbility.MANAGE, 'NONE'],
    [EUserRole.AGENT, 'Ticket', EAbility.READ, 'NONE'],
    [EUserRole.AGENT, 'Ticket', EAbility.CREATE, 'NONE'],
    [EUserRole.AGENT, 'Ticket', EAbility.UPDATE, 'ASSIGNED_TO_ME'],
    [EUserRole.AGENT, 'MyMetric', EAbility.READ, 'NONE'],
    [EUserRole.SUPERVISOR, 'Ticket', EAbility.READ, 'NONE'],
    [EUserRole.SUPERVISOR, 'Ticket', EAbility.CREATE, 'NONE'],
    [EUserRole.SUPERVISOR, 'Ticket', EAbility.UPDATE, 'NONE'],
    [EUserRole.SUPERVISOR, 'Metric', EAbility.READ, 'NONE'],
    [EUserRole.SUPERVISOR, 'MyMetric', EAbility.READ, 'NONE'],
    [EUserRole.SUPERVISOR, 'User', EAbility.READ, 'NONE'],
    // Cliente: registra solicitudes; ve y gestiona las SUYAS (regla de titular) y lo que le compartan.
    // Auditor: solo lectura de tickets, métricas y auditoría.
    [EUserRole.AUDITOR, 'Ticket', EAbility.READ, 'NONE'],
    [EUserRole.AUDITOR, 'Metric', EAbility.READ, 'NONE'],
    [EUserRole.AUDITOR, 'AuditLog', EAbility.READ, 'NONE'],
    [EUserRole.AUDITOR, 'User', EAbility.READ, 'NONE'],
    [EUserRole.VIEWER, 'Ticket', EAbility.CREATE, 'NONE'],
  ];
  return rows.map(([role, subject, action, condition], index) => ({
    uuid: `7a000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    role,
    subject,
    action,
    condition,
    createdAt: SEED_AT,
  }));
}

function seedMenu(): IMenuItem[] {
  const rows: [string, string, string, string, string, TSubjects | null, EAbility | null, number][] = [
    ['board', 'Tablero', '/tickets', 'Tickets', 'pi-th-large', 'Ticket', null, 10],
    ['list', 'Listado', '/tickets/list', 'Tickets', 'pi-list', 'Ticket', null, 20],
    ['new-ticket', 'Nuevo ticket', '/tickets/new', 'Tickets', 'pi-plus', 'Ticket', EAbility.CREATE, 30],
    ['sharing', 'Compartir mis tickets', '/sharing', 'Tickets', 'pi-share-alt', 'Relationship', EAbility.CREATE, 40],
    ['metrics', 'Métricas del equipo', '/metrics', 'Servicio', 'pi-chart-line', 'Metric', EAbility.READ, 10],
    ['my-metrics', 'Mis métricas', '/my-metrics', 'Servicio', 'pi-chart-bar', 'MyMetric', EAbility.READ, 20],
    ['profile', 'Mi perfil', '/profile', 'Preferencias', 'pi-user', null, null, 10],
    ['appearance', 'Apariencia', '/appearance', 'Preferencias', 'pi-palette', null, null, 20],
    ['style-guide', 'Guía de estilos', '/style-guide', 'Preferencias', 'pi-book', null, null, 30],
    ['role-matrix', 'Matriz de roles', '/role-matrix', 'Administración', 'pi-table', 'RolePermission', EAbility.READ, 10],
    ['role-permissions', 'Permisos por rol', '/role-permissions', 'Administración', 'pi-shield', 'RolePermission', EAbility.READ, 20],
    ['users', 'Usuarios', '/users', 'Administración', 'pi-users', 'User', EAbility.READ, 30],
    ['relation-permissions', 'Relaciones', '/relation-permissions', 'Administración', 'pi-sitemap', 'Relationship', EAbility.MANAGE, 40],
    ['menu-items', 'Menú', '/menu-items', 'Administración', 'pi-bars', 'MenuItem', EAbility.READ, 50],
    ['catalogs', 'Catálogos', '/catalogs', 'Administración', 'pi-database', 'Catalog', EAbility.READ, 60],
    ['audit-logs', 'Auditoría', '/audit-logs', 'Administración', 'pi-history', 'AuditLog', EAbility.READ, 70],
    // Va al final de la lista (los uuid del mock salen del índice) pero se ordena primero en su grupo.
    ['my-tickets', 'Mis tickets', '/my-tickets', 'Tickets', 'pi-inbox', 'Ticket', null, 5],
    ['jobs', 'Tareas programadas', '/jobs', 'Administración', 'pi-clock', 'ScheduledJob', EAbility.READ, 80],
  ];
  return rows.map(([key, label, route, group, icon, subject, requiredAction, order], index) => ({
    uuid: `3e000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    key,
    label,
    route,
    group,
    icon,
    subject,
    requiredAction,
    order,
    active: true,
    createdAt: SEED_AT,
  }));
}

function seedCatalogs(): { catalogs: ICatalog[]; items: ICatalogItem[] } {
  type TRow = [code: string, label: string, icon: string, severity: TBadgeSeverity];
  const defs: [string, string, string, TRow[]][] = [
    ['ticket-type', 'Tipo de ticket', 'Incidencia o solicitud (paso 3 de CU05).', [
      ['incident', 'Incidente', 'pi-bolt', 'danger'],
      ['service_request', 'Solicitud de servicio', 'pi-briefcase', 'info'],
      ['inquiry', 'Consulta', 'pi-question-circle', 'secondary'],
      ['improvement', 'Mejora', 'pi-lightbulb', 'success'],
    ]],
    ['ticket-category', 'Categoría de ticket', 'Área funcional del caso (paso 4 de CU05).', [
      ['hardware', 'Hardware', 'pi-desktop', 'secondary'],
      ['software', 'Software', 'pi-code', 'info'],
      ['network', 'Red y conectividad', 'pi-wifi', 'info'],
      ['access', 'Accesos y cuentas', 'pi-key', 'warn'],
      ['email', 'Correo', 'pi-envelope', 'secondary'],
      ['other', 'Otra', 'pi-ellipsis-h', 'contrast'],
    ]],
    ['ticket-priority', 'Urgencia de ticket', 'Urgencia con la que se atiende (paso 5 de CU05).', [
      ['low', 'Baja', 'pi-angle-down', 'secondary'],
      ['medium', 'Media', 'pi-minus', 'info'],
      ['high', 'Alta', 'pi-angle-up', 'warn'],
      ['critical', 'Crítica', 'pi-exclamation-triangle', 'danger'],
    ]],
    ['ticket-complexity', 'Complejidad de ticket', 'Esfuerzo estimado; la fija el equipo de soporte.', [
      ['simple', 'Simple', 'pi-circle', 'success'],
      ['moderate', 'Moderada', 'pi-circle-fill', 'warn'],
      ['complex', 'Compleja', 'pi-sitemap', 'danger'],
    ]],
    ['ticket-department', 'Departamento de origen', 'De qué área viene la solicitud; «TI (interno)» cuando nace dentro del propio equipo de TI. Se pueden agregar departamentos.', [
      ['it', 'TI (interno)', 'pi-desktop', 'contrast'],
      ['hr', 'Recursos Humanos', 'pi-users', 'info'],
      ['finance', 'Finanzas', 'pi-wallet', 'success'],
      ['sales', 'Ventas', 'pi-chart-line', 'warn'],
      ['operations', 'Operaciones', 'pi-cog', 'secondary'],
      ['admin', 'Administración', 'pi-briefcase', 'secondary'],
    ]],
    ['ticket-status', 'Estado de ticket', 'Ciclo de vida del ticket (los códigos son fijos).', [
      ['new', 'Nuevo', 'pi-inbox', 'info'],
      ['assigned', 'Asignado', 'pi-user-plus', 'info'],
      ['in_progress', 'En atención', 'pi-clock', 'warn'],
      ['pending_customer', 'Pendiente del cliente', 'pi-hourglass', 'secondary'],
      ['escalated', 'Escalado (N2/N3)', 'pi-angle-double-up', 'danger'],
      ['resolved', 'Resuelto', 'pi-check', 'success'],
      ['closed', 'Cerrado', 'pi-lock', 'contrast'],
      ['reopened', 'Reabierto', 'pi-replay', 'warn'],
    ]],
  ];
  return {
    catalogs: defs.map(([key, name, description]) => ({ key, name, description, system: true })),
    items: defs.flatMap(([catalogKey, , , rows]) =>
      rows.map(([code, label, icon, severity], index) => ({
        uuid: crypto.randomUUID(),
        catalogKey,
        code,
        label,
        order: (index + 1) * 10,
        active: true,
        // En el catálogo de departamentos solo `it` es de sistema; el resto lo administra la organización.
        system: catalogKey === 'ticket-department' ? code === 'it' : true,
        icon,
        severity,
      })),
    ),
  };
}

const state: {
  rules: IRule[];
  menu: IMenuItem[];
  catalogs: ICatalog[];
  catalogItems: ICatalogItem[];
  relationships: IRelationship[];
  audit: IAuditEntry[];
} = { rules: [], menu: [], catalogs: [], catalogItems: [], relationships: [], audit: [] };

/** Estado inicial (el mock se reinicia al recargar la página; los tests lo llaman en `beforeEach`). */
export function resetAdminState(): void {
  const catalogs = seedCatalogs();
  state.rules = seedRules();
  state.menu = seedMenu();
  state.catalogs = catalogs.catalogs;
  state.catalogItems = catalogs.items;
  state.relationships = [];
  state.audit = [];
}
resetAdminState();

// ── Sesión: reglas y menú que resolvería el backend ────────────────────────────────────────────
const CONDITIONS: Record<TConditionPreset, (user: TShell['user']) => Record<string, unknown> | undefined> = {
  NONE: () => undefined,
  OWN: (user) => ({ ownerUuid: user.uuid }),
  ASSIGNED_TO_ME: (user) => ({ assigneeEmail: user.email }),
};

/** Igual que `CaslAbilityFactory.rulesFor`: RBAC del rol + titular + ReBAC + autoservicio. */
export function rulesFor(user: TShell['user']): TRule[] {
  const roleRules = state.rules
    .filter((rule) => rule.role === user.role)
    .map<TRule>((rule) => {
      const conditions = CONDITIONS[rule.condition](user);
      return { action: rule.action, subject: rule.subject, ...(conditions ? { conditions } : {}) };
    });
  const own = { ownerUuid: user.uuid };
  // El titular lee y EDITA lo suyo, pero NO lo elimina ni lo restaura (solo la administración).
  const ticket: TRule[] = [
    { action: EAbility.READ, subject: 'Ticket', conditions: own },
    { action: EAbility.UPDATE, subject: 'Ticket', conditions: own },
  ];
  // El cliente (y el auditor) NO manipulan los accesos a un ticket: compartir es del equipo.
  const titular: TRule[] =
    user.role === EUserRole.VIEWER || user.role === EUserRole.AUDITOR
      ? ticket
      : [
          ...ticket,
          { action: EAbility.CREATE, subject: 'Relationship' },
          { action: EAbility.READ, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
          { action: EAbility.UPDATE, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
          { action: EAbility.DELETE, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
        ];
  // ReBAC: lo que otras personas compartieron conmigo (cliente y auditor nunca escriben: techo del rol).
  const canWrite = user.role !== EUserRole.VIEWER && user.role !== EUserRole.AUDITOR;
  const grants = state.relationships
    .filter((r) => r.status === 'ACTIVE' && r.alternanteUuid === user.uuid)
    .map((r) => ({ titular: r.titularUuid, grant: r.grants[0] }))
    .filter((entry): entry is { titular: string; grant: IGrant } => !!entry.grant);
  const via = (action: EAbility, titulares: string[]): TRule[] =>
    titulares.length ? [{ action, subject: 'Ticket', conditions: { ownerUuid: { $in: titulares } } }] : [];
  const rebac = [
    ...via(EAbility.READ, grants.filter((g) => g.grant.canRead).map((g) => g.titular)),
    ...via(EAbility.UPDATE, canWrite ? grants.filter((g) => g.grant.canUpdate).map((g) => g.titular) : []),
  ];
  const selfService: TRule[] = [
    { action: EAbility.READ, subject: 'Notification', conditions: { recipientUuid: user.uuid } },
    { action: EAbility.UPDATE, subject: 'Notification', conditions: { recipientUuid: user.uuid } },
    { action: EAbility.READ, subject: 'Relationship', conditions: { alternanteUuid: user.uuid } },
  ];
  return [...roleRules, ...titular, ...rebac, ...selfService];
}

/** Menú administrable: solo los ítems activos y en su orden. QUIÉN los ve lo decide CASL en el front. */
export function menuFor(): TMenuEntry[] {
  return state.menu
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'))
    .map<TMenuEntry>((item) => ({
      key: item.key,
      label: item.label,
      route: item.route,
      ...(item.group ? { group: item.group } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
      ...(item.subject ? { subject: item.subject } : {}),
      ...(item.requiredAction ? { requiredAction: item.requiredAction } : {}),
    }));
}

export function buildShell(user: TShell['user']): TShell {
  return { user: structuredClone(user), abilityRules: rulesFor(user), menu: menuFor() };
}

/** ¿`code` es un elemento ACTIVO de ese catálogo? (valida campos que apuntan a un catálogo editable). */
export function isActiveCatalogCode(catalogKey: string, code: string): boolean {
  return state.catalogItems.some((i) => i.catalogKey === catalogKey && i.code === code && i.active);
}

/** Etiqueta actual de un elemento de catálogo (el tablero rotula sus columnas con `ticket-status`). */
export function catalogLabel(catalogKey: string, code: string, fallback: string): string {
  return state.catalogItems.find((i) => i.catalogKey === catalogKey && i.code === code)?.label ?? fallback;
}

// ── Auditoría ───────────────────────────────────────────────────────────────────────────────────
const UUID_SEGMENT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export interface IAuditInput {
  req: HttpRequest<unknown>;
  status: number;
  actor: TShell['user'] | null;
}

/** Misma regla que `AuditMiddleware` del backend: toda mutación, también la denegada; solo NOMBRES de campos. */
export function recordAudit({ req, status, actor }: IAuditInput): void {
  const path = new URL(req.urlWithParams, 'http://mock').pathname;
  const uuid = path.match(UUID_SEGMENT)?.[0] ?? null;
  const methodAction: Record<string, IAuditEntry['action']> = { POST: 'CREATE', DELETE: 'DELETE' };
  const action: IAuditEntry['action'] =
    path === '/api/auth/sign-in' ? 'SIGN_IN' : path === '/api/auth/sign-out' ? 'SIGN_OUT' : (methodAction[req.method] ?? 'UPDATE');
  const outcome: IAuditEntry['outcome'] = status < 400 ? 'SUCCESS' : [401, 403, 429].includes(status) ? 'DENIED' : 'FAILED';
  const body = req.body;
  state.audit = [
    {
      uuid: crypto.randomUUID(),
      at: new Date().toISOString(),
      action,
      subject: path.split('/')[2] ?? 'unknown',
      route: path.replace(UUID_SEGMENT, ':uuid'),
      method: req.method,
      resourceUuid: uuid,
      status,
      outcome,
      actorUuid: actor?.uuid ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      ip: '127.0.0.1',
      userAgent: navigator.userAgent.slice(0, 200),
      requestId: crypto.randomUUID(),
      changedFields: body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).slice(0, 30) : [],
    },
    ...state.audit,
  ].slice(0, 5000);
}

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────────
function paginate<T>(rows: T[], url: URL): { data: T[]; meta: { total: number; page: number; take: number } } {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take') ?? 10)));
  return { data: rows.slice((page - 1) * take, page * take), meta: { total: rows.length, page, take } };
}

const matchesSearch = (url: URL, ...values: (string | null)[]): boolean => {
  const term = (url.searchParams.get('search') ?? '').trim().toLowerCase();
  return !term || values.some((value) => (value ?? '').toLowerCase().includes(term));
};

const byNewest = <T extends { createdAt: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const ITEM = (collection: string) => new RegExp(`^/api/${collection}/([\\w-]+)$`);
const USERS_ITEM = /^\/api\/users\/([\w-]+)(\/role|\/status)?$/;
const CATALOG_PATH = /^\/api\/catalogs\/([a-z][a-z0-9-]*)(?:\/(options)|\/items(?:\/([\w-]+))?)?$/;
const RELATIONSHIP_PATH = /^\/api\/relationships\/([\w-]+)(\/grants)?$/;
const RELATIONSHIP_ADMIN_PATH = /^\/api\/relationships\/admin(?:\/([\w-]+))?$/;

const toAdminUser = (account: IAdminAccount) => ({
  ...account.shell.user,
  emailVerified: account.verified,
  disabled: account.disabled,
  locked: !!account.lockedAt,
  lockedAt: account.lockedAt,
  createdAt: account.createdAt,
});

/**
 * Rutas de administración del mock: usuarios, permisos por rol, menú, catálogos, auditoría y
 * relaciones. Mismos contratos, validaciones y códigos de error que el backend. `null` = no es mía.
 */
export function handleAdmin(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> | null {
  const { pathname } = url;
  if (pathname === '/api/users' || USERS_ITEM.test(pathname)) {
    if (pathname === '/api/users/assignable') return null;
    if (pathname.startsWith('/api/users/me')) return null;
    return users(req, url, h);
  }
  if (pathname === '/api/role-permissions' || ITEM('role-permissions').test(pathname)) return rolePermissions(req, url, h);
  if (pathname === '/api/menu-items' || ITEM('menu-items').test(pathname)) return menuItems(req, url, h);
  if (pathname === '/api/catalogs' || CATALOG_PATH.test(pathname)) return catalogs(req, url, h);
  if (pathname === '/api/audit-logs' || ITEM('audit-logs').test(pathname)) return auditLogs(req, url, h);
  if (RELATIONSHIP_ADMIN_PATH.test(pathname)) return relationshipsAdmin(req, url, h);
  if (pathname === '/api/relationships' || RELATIONSHIP_PATH.test(pathname)) return relationships(req, url, h);
  return null;
}

// ── Usuarios ────────────────────────────────────────────────────────────────────────────────────
function users(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  const match = USERS_ITEM.exec(url.pathname);
  if (req.method === 'GET' && !match) {
    if (!h.can('read', 'User')) return h.forbidden(req);
    const role = url.searchParams.get('role');
    const rows = h
      .accounts()
      .filter((a) => !role || a.shell.user.role === role)
      .filter((a) => matchesSearch(url, a.name, a.email))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(toAdminUser);
    return h.ok(paginate(rows, url));
  }
  const account = h.accounts().find((a) => a.shell.user.uuid === match?.[1]);
  if (req.method === 'GET') {
    if (!h.can('read', 'User')) return h.forbidden(req);
    return account ? h.ok(toAdminUser(account)) : h.fail(req, 404, 'SUSR-E002', 'Usuario no encontrado');
  }
  if (req.method !== 'PATCH' || !match?.[2]) return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  if (!h.can('update', 'User')) return h.forbidden(req);
  if (!account) return h.fail(req, 404, 'SUSR-E002', 'Usuario no encontrado');

  const body = (req.body ?? {}) as Record<string, unknown>;
  const isSelf = account.email === h.currentEmail();
  const activeAdmins = h.accounts().filter((a) => a.shell.user.role === EUserRole.ADMIN && !a.disabled).length;
  const lastAdmin = account.shell.user.role === EUserRole.ADMIN && !account.disabled && activeAdmins <= 1;

  if (match[2] === '/role') {
    const role = body['role'];
    const valid = Object.keys(body).length === 1 && Object.values(EUserRole).includes(role as EUserRole);
    if (!valid) return h.fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('role', 'Selecciona un rol')]);
    if (account.shell.user.role === role) return h.ok(toAdminUser(account));
    if (isSelf) return h.fail(req, 409, 'SUSR-E003', 'No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta');
    if (lastAdmin) return h.fail(req, 409, 'SUSR-E004', 'Debe quedar al menos un administrador activo');
    account.shell.user.role = role as EUserRole;
    return h.ok(toAdminUser(account));
  }

  // `locked: false` DESBLOQUEA la cuenta (bloquear solo ocurre por intentos fallidos; `true` no es válido).
  const keys = Object.keys(body).filter((key) => key !== 'locked');
  if (('locked' in body && body['locked'] !== false) || keys.length !== 1 || typeof body['disabled'] !== 'boolean') {
    return h.fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('disabled', 'Indica si la cuenta queda deshabilitada')]);
  }
  if (body['locked'] === false && account.lockedAt) {
    account.lockedAt = null;
    account.failedLogins = 0;
  }
  const disabled = body['disabled'];
  if (account.disabled === disabled) return h.ok(toAdminUser(account));
  if (disabled && isSelf) return h.fail(req, 409, 'SUSR-E003', 'No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta');
  if (disabled && lastAdmin) return h.fail(req, 409, 'SUSR-E004', 'Debe quedar al menos un administrador activo');
  account.disabled = disabled;
  if (disabled) h.endSessionOf(account.email);
  return h.ok(toAdminUser(account));
}

// ── Permisos por rol ────────────────────────────────────────────────────────────────────────────
function rolePermissions(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  const match = ITEM('role-permissions').exec(url.pathname);
  const subjectName: TSubjects = 'RolePermission';
  const action = ({ GET: 'read', POST: 'create', PATCH: 'update', DELETE: 'delete' } as Record<string, string>)[req.method];
  if (!action) return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  if (!h.can(action, subjectName)) return h.forbidden(req);

  if (!match) {
    if (req.method === 'GET') {
      const role = url.searchParams.get('role');
      const subject = url.searchParams.get('subject');
      const rows = byNewest(state.rules)
        .filter((r) => (!role || r.role === role) && (!subject || r.subject === subject))
        .filter((r) => matchesSearch(url, r.role, r.subject, r.action));
      return h.ok(paginate(rows, url));
    }
    const parsed = RolePermissionUpsertSchema.safeParse(req.body);
    if (!parsed.success) return h.invalid(req, parsed.error);
    if (state.rules.some((r) => sameRule(r, parsed.data))) return h.fail(req, 409, 'RRPM-E002', 'Ese rol ya tiene ese permiso');
    const created: IRule = { uuid: crypto.randomUUID(), createdAt: new Date().toISOString(), ...parsed.data };
    state.rules = [...state.rules, created];
    return h.ok(created, 201);
  }

  const current = state.rules.find((r) => r.uuid === match[1]);
  if (!current) return h.fail(req, 404, 'RRPM-E001', 'Permiso de rol no encontrado');
  if (req.method === 'GET') return h.ok(current);
  if (req.method === 'DELETE') {
    state.rules = state.rules.filter((r) => r.uuid !== current.uuid);
    return h.ok(null, 204);
  }
  const parsed = RolePermissionUpsertSchema.safeParse(req.body);
  if (!parsed.success) return h.invalid(req, parsed.error);
  if (state.rules.some((r) => r.uuid !== current.uuid && sameRule(r, parsed.data))) {
    return h.fail(req, 409, 'RRPM-E002', 'Ese rol ya tiene ese permiso');
  }
  const updated = { ...current, ...parsed.data };
  state.rules = state.rules.map((r) => (r.uuid === current.uuid ? updated : r));
  return h.ok(updated);
}

const sameRule = (a: Omit<IRule, 'uuid' | 'createdAt'>, b: Omit<IRule, 'uuid' | 'createdAt'>): boolean =>
  a.role === b.role && a.subject === b.subject && a.action === b.action && a.condition === b.condition;

// ── Menú ────────────────────────────────────────────────────────────────────────────────────────
function menuItems(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  const match = ITEM('menu-items').exec(url.pathname);
  const action = ({ GET: 'read', POST: 'create', PATCH: 'update', DELETE: 'delete' } as Record<string, string>)[req.method];
  if (!action) return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  if (!h.can(action, 'MenuItem')) return h.forbidden(req);

  if (!match) {
    if (req.method === 'GET') {
      const group = url.searchParams.get('group');
      const rows = [...state.menu]
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'))
        .filter((m) => !group || m.group === group)
        .filter((m) => matchesSearch(url, m.key, m.label, m.route, m.group));
      return h.ok(paginate(rows, url));
    }
    const parsed = MenuItemUpsertSchema.safeParse(req.body);
    if (!parsed.success) return h.invalid(req, parsed.error);
    if (state.menu.some((m) => m.key === parsed.data.key)) return h.fail(req, 409, 'RMNU-E002', 'Ya existe un ítem de menú con esa clave');
    const created: IMenuItem = { uuid: crypto.randomUUID(), createdAt: new Date().toISOString(), ...parsed.data };
    state.menu = [...state.menu, created];
    return h.ok(created, 201);
  }

  const current = state.menu.find((m) => m.uuid === match[1]);
  if (!current) return h.fail(req, 404, 'RMNU-E001', 'Ítem de menú no encontrado');
  if (req.method === 'GET') return h.ok(current);
  if (req.method === 'DELETE') {
    state.menu = state.menu.filter((m) => m.uuid !== current.uuid);
    return h.ok(null, 204);
  }
  const parsed = MenuItemUpsertSchema.safeParse(req.body);
  if (!parsed.success) return h.invalid(req, parsed.error);
  if (state.menu.some((m) => m.uuid !== current.uuid && m.key === parsed.data.key)) {
    return h.fail(req, 409, 'RMNU-E002', 'Ya existe un ítem de menú con esa clave');
  }
  const updated = { ...current, ...parsed.data };
  state.menu = state.menu.map((m) => (m.uuid === current.uuid ? updated : m));
  return h.ok(updated);
}

// ── Catálogos ───────────────────────────────────────────────────────────────────────────────────
const itemsOf = (key: string): ICatalogItem[] =>
  state.catalogItems
    .filter((i) => i.catalogKey === key)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'));

const summary = (c: ICatalog) => ({ ...c, itemCount: itemsOf(c.key).length });
const itemBody = ({ uuid, code, label, order, active, icon, severity, system }: ICatalogItem) => ({ uuid, code, label, order, active, icon, severity, system });

function catalogs(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  const match = CATALOG_PATH.exec(url.pathname);
  const [, key, options, itemUuid] = match ?? [];
  const isItems = url.pathname.includes('/items');

  // Opciones para formularios: cualquier sesión (sin permiso de administración).
  if (options) {
    return state.catalogs.some((c) => c.key === key)
      ? h.ok({ data: itemsOf(key as string).filter((i) => i.active).map((i) => ({ value: i.code, label: i.label, icon: i.icon, severity: i.severity })) })
      : h.fail(req, 404, 'RCAT-E001', 'Catálogo no encontrado');
  }
  const action = ({ GET: 'read', POST: 'create', PATCH: 'update', DELETE: 'delete' } as Record<string, string>)[req.method];
  if (!action) return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  // Los elementos se administran con `update` del catálogo (igual que el backend).
  if (!h.can(isItems && req.method !== 'GET' ? 'update' : action, 'Catalog')) return h.forbidden(req);

  if (!key) {
    if (req.method === 'GET') {
      return h.ok({ data: [...state.catalogs].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(summary) });
    }
    const parsed = CatalogCreateSchema.safeParse(req.body);
    if (!parsed.success) return h.invalid(req, parsed.error);
    if (state.catalogs.some((c) => c.key === parsed.data.key)) return h.fail(req, 409, 'RCAT-E005', 'Ya existe un catálogo con esa clave');
    const created: ICatalog = { ...parsed.data, system: false };
    state.catalogs = [...state.catalogs, created];
    return h.ok(summary(created), 201);
  }

  const catalog = state.catalogs.find((c) => c.key === key);
  if (!catalog) return h.fail(req, 404, 'RCAT-E001', 'Catálogo no encontrado');

  if (!isItems) {
    if (req.method === 'GET') return h.ok({ ...summary(catalog), items: itemsOf(key).map(itemBody) });
    if (req.method === 'DELETE') {
      if (catalog.system) return h.fail(req, 409, 'RCAT-E004', 'Los elementos del sistema no se eliminan ni cambian de código');
      state.catalogs = state.catalogs.filter((c) => c.key !== key);
      state.catalogItems = state.catalogItems.filter((i) => i.catalogKey !== key);
      return h.ok(null, 204);
    }
    const parsed = CatalogUpdateSchema.safeParse(req.body);
    if (!parsed.success) return h.invalid(req, parsed.error);
    const updated = { ...catalog, ...parsed.data };
    state.catalogs = state.catalogs.map((c) => (c.key === key ? updated : c));
    return h.ok(summary(updated));
  }

  if (!itemUuid) {
    if (req.method !== 'POST') return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
    const parsed = CatalogItemUpsertSchema.safeParse(req.body);
    if (!parsed.success) return h.invalid(req, parsed.error);
    if (codeTaken(key, parsed.data.code)) return h.fail(req, 409, 'RCAT-E003', 'Ese código ya existe en este catálogo');
    const created: ICatalogItem = { uuid: crypto.randomUUID(), catalogKey: key, system: false, ...parsed.data };
    state.catalogItems = [...state.catalogItems, created];
    return h.ok(itemBody(created), 201);
  }

  const item = state.catalogItems.find((i) => i.catalogKey === key && i.uuid === itemUuid);
  if (!item) return h.fail(req, 404, 'RCAT-E002', 'Elemento del catálogo no encontrado');
  if (req.method === 'DELETE') {
    if (item.system) return h.fail(req, 409, 'RCAT-E004', 'Los elementos del sistema no se eliminan ni cambian de código');
    state.catalogItems = state.catalogItems.filter((i) => i.uuid !== item.uuid);
    return h.ok(null, 204);
  }
  const parsed = CatalogItemUpsertSchema.safeParse(req.body);
  if (!parsed.success) return h.invalid(req, parsed.error);
  if (item.system && (parsed.data.code !== item.code || !parsed.data.active)) {
    return h.fail(req, 409, 'RCAT-E004', 'Los elementos del sistema no se eliminan ni cambian de código');
  }
  if (codeTaken(key, parsed.data.code, item.uuid)) return h.fail(req, 409, 'RCAT-E003', 'Ese código ya existe en este catálogo');
  const updated = { ...item, ...parsed.data };
  state.catalogItems = state.catalogItems.map((i) => (i.uuid === item.uuid ? updated : i));
  return h.ok(itemBody(updated));
}

const codeTaken = (key: string, code: string, exceptUuid?: string): boolean =>
  state.catalogItems.some((i) => i.catalogKey === key && i.uuid !== exceptUuid && i.code.toLowerCase() === code.toLowerCase());

// ── Auditoría (solo lectura) ────────────────────────────────────────────────────────────────────
function auditLogs(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  if (req.method !== 'GET') return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  if (!h.can('read', 'AuditLog')) return h.forbidden(req);
  const match = ITEM('audit-logs').exec(url.pathname);
  if (match) {
    const entry = state.audit.find((e) => e.uuid === match[1]);
    return entry ? h.ok(entry) : h.fail(req, 404, 'SAUD-E001', 'Entrada de auditoría no encontrada');
  }
  const { searchParams } = url;
  const rows = state.audit
    .filter((e) => !searchParams.get('action') || e.action === searchParams.get('action'))
    .filter((e) => !searchParams.get('outcome') || e.outcome === searchParams.get('outcome'))
    .filter((e) => !searchParams.get('subject') || e.subject === searchParams.get('subject'))
    .filter((e) => matchesSearch(url, e.actorEmail, e.route, e.subject, e.resourceUuid));
  return h.ok(paginate(rows, url));
}

// ── Relaciones (compartir) ──────────────────────────────────────────────────────────────────────
const CURRENT_USER_UUID = (h: IMockHelpers): string | null =>
  h.accounts().find((a) => a.email === h.currentEmail())?.shell.user.uuid ?? null;

function relationships(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  const me = CURRENT_USER_UUID(h);
  if (!me) return h.fail(req, 401, 'SAUT-E002', 'Debes iniciar sesión');
  const view = (r: IRelationship) => ({ ...r, myRole: r.titularUuid === me ? 'TITULAR' : 'ALTERNANTE' });
  const match = RELATIONSHIP_PATH.exec(url.pathname);

  if (!match) {
    if (req.method === 'GET') {
      return h.ok(state.relationships.filter((r) => r.titularUuid === me || r.alternanteUuid === me).map(view));
    }
    if (req.method !== 'POST') return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
    if (!h.can('create', 'Relationship')) return h.forbidden(req);
    const body = (req.body ?? {}) as { alternanteEmail?: string; grants?: { canUpdate?: boolean; notifyTitular?: boolean }[]; consent?: unknown };
    const email = String(body.alternanteEmail ?? '').toLowerCase();
    const grant = body.grants?.[0];
    if (body.consent !== true) return h.fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('consent', 'Debes aceptar el consentimiento para compartir tus datos')]);
    if (!email || !grant) return h.fail(req, 400, 'CVAL-E001', 'Datos inválidos', [fieldError('alternanteEmail', 'Ingresa un correo válido')]);
    const target = h.accounts().find((a) => a.email === email);
    if (target?.shell.user.uuid === me) return h.fail(req, 422, 'SREL-E001', 'No puedes compartir tus datos contigo mismo');
    if (!target) return h.fail(req, 422, 'SREL-E002', 'La persona alternante no existe');
    if (state.relationships.some((r) => r.status === 'ACTIVE' && r.titularUuid === me && r.alternanteUuid === target.shell.user.uuid)) {
      return h.fail(req, 409, 'SREL-E003', 'Ya existe una relación activa con esa persona');
    }
    const created: IRelationship = {
      uuid: crypto.randomUUID(),
      titularUuid: me,
      alternanteUuid: target.shell.user.uuid,
      alternanteEmail: email,
      status: 'ACTIVE',
      grants: [makeGrant(grant)],
      endedAt: null,
      createdAt: new Date().toISOString(),
    };
    state.relationships = [...state.relationships, created];
    return h.ok(view(created), 201);
  }

  const current = state.relationships.find((r) => r.uuid === match[1] && r.status === 'ACTIVE' && (r.titularUuid === me || r.alternanteUuid === me));
  if (!current) return h.fail(req, 404, 'RREL-E001', 'Relación no encontrada');
  if (current.titularUuid !== me) return h.fail(req, 403, 'SREL-E004', 'Solo el titular puede cambiar las reglas de la relación');

  if (req.method === 'DELETE') {
    state.relationships = state.relationships.map((r) =>
      r.uuid === current.uuid ? { ...r, status: 'REVOKED', endedAt: new Date().toISOString() } : r,
    );
    return h.ok(null, 204);
  }
  if (req.method === 'PATCH' && match[2]) {
    const body = (req.body ?? {}) as { grants?: { canUpdate?: boolean; notifyTitular?: boolean }[]; consent?: unknown };
    const parsed = GrantsFormSchema.safeParse({ ...(body.grants?.[0] ?? {}), consent: body.consent });
    if (!parsed.success) return h.invalid(req, parsed.error);
    const updated: IRelationship = { ...current, grants: [makeGrant(parsed.data)] };
    state.relationships = state.relationships.map((r) => (r.uuid === current.uuid ? updated : r));
    return h.ok(view(updated));
  }
  return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
}

/** Administración de relaciones: ve TODAS (con nombres) y revoca cualquiera; exige `manage Relationship`. */
function relationshipsAdmin(req: HttpRequest<unknown>, url: URL, h: IMockHelpers): TResponse$ | Observable<never> {
  if (!h.can('manage', 'Relationship')) return h.forbidden(req);
  const uuid = RELATIONSHIP_ADMIN_PATH.exec(url.pathname)?.[1];
  const person = (personUuid: string) => {
    const account = h.accounts().find((a) => a.shell.user.uuid === personUuid);
    return { name: account?.name ?? '(cuenta desconocida)', email: account?.email ?? '' };
  };

  if (!uuid) {
    if (req.method !== 'GET') return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
    const status = url.searchParams.get('status');
    const rows = byNewest(state.relationships)
      .filter((r) => !status || r.status === status)
      .map((r) => {
        const titular = person(r.titularUuid);
        const alternante = person(r.alternanteUuid);
        const grant = r.grants[0];
        return {
          uuid: r.uuid,
          titularUuid: r.titularUuid,
          titularName: titular.name,
          titularEmail: titular.email,
          alternanteUuid: r.alternanteUuid,
          alternanteName: alternante.name,
          alternanteEmail: alternante.email,
          status: r.status,
          canRead: grant?.canRead ?? false,
          canUpdate: grant?.canUpdate ?? false,
          notifyTitular: grant?.notifyTitular ?? false,
          consentVersion: grant?.consentVersion ?? null,
          consentedAt: grant?.consentedAt ?? null,
          endedAt: r.endedAt,
          createdAt: r.createdAt,
        };
      })
      .filter((row) => matchesSearch(url, row.titularName, row.titularEmail, row.alternanteName, row.alternanteEmail));
    return h.ok(paginate(rows, url));
  }

  if (req.method !== 'DELETE') return h.fail(req, 405, 'NEST-E405', 'Método no permitido');
  const current = state.relationships.find((r) => r.uuid === uuid && r.status === 'ACTIVE');
  if (!current) return h.fail(req, 404, 'RREL-E001', 'Relación no encontrada');
  state.relationships = state.relationships.map((r) =>
    r.uuid === uuid ? { ...r, status: 'REVOKED', endedAt: new Date().toISOString() } : r,
  );
  return h.ok(null, 204);
}

function makeGrant(input: { canUpdate?: boolean; notifyTitular?: boolean }): IGrant {
  return {
    objectType: 'Ticket',
    canRead: true,
    canUpdate: !!input.canUpdate,
    notifyTitular: input.notifyTitular ?? true,
    consentVersion: CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
  };
}

function fieldError(path: string, message: string): IProblemFieldError {
  return { pointer: `#/${path}`, path, message, code: 'invalid_value' };
}

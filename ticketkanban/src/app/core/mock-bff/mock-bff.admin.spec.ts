import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility, subject } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

const MARTA = '0b8a5f6e-1c2d-4e3f-8a9b-000000000001';
const VICTOR = '0b8a5f6e-1c2d-4e3f-8a9b-000000000003';

interface IPage<T> {
  data: T[];
  meta: { total: number; page: number; take: number };
}
interface IAuditRow {
  action: string;
  outcome: string;
  route: string;
  actorEmail: string | null;
  changedFields: string[];
}

/**
 * El BFF falso de ADMINISTRACIÓN responde con los mismos contratos, validaciones y códigos de error que
 * ticketlistbe (ver sus e2e `users-admin`, `audit-log`, `menu-items`, `catalogs`).
 */
describe('mock BFF · administración', () => {
  let store: SessionStore;
  let ability: AppAbility;
  let http: HttpClient;

  beforeEach(() => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    store = TestBed.inject(SessionStore);
    ability = TestBed.inject(AppAbility);
    http = TestBed.inject(HttpClient);
  });

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));
  const send = (method: 'post' | 'patch' | 'delete', url: string, body?: object) =>
    firstValueFrom(method === 'delete' ? http.delete(url) : http[method](url, body ?? {}));
  const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
    readProblem(await promise.catch((e: unknown) => e))?.code;

  it('un AGENT o VIEWER no administra nada (403 SAUT-E001)', async () => {
    for (const role of [EUserRole.AGENT, EUserRole.VIEWER]) {
      await store.signInAs(role);
      for (const url of ['/api/users', '/api/role-permissions', '/api/menu-items', '/api/catalogs', '/api/audit-logs']) {
        expect(await codeOf(get(url)), `${role} ${url}`).toBe('SAUT-E001');
      }
    }
  });

  describe('usuarios', () => {
    beforeEach(() => store.signInAs(EUserRole.ADMIN));

    it('lista con búsqueda y filtro de rol, sin datos sensibles', async () => {
      const all = await get<IPage<{ email: string; role: string }>>('/api/users');
      expect(all.meta.total).toBe(7);
      expect(JSON.stringify(all)).not.toMatch(/password/i);
      const viewers = await get<IPage<{ role: string }>>('/api/users?role=VIEWER');
      expect(viewers.data.every((u) => u.role === 'VIEWER')).toBe(true);
      const found = await get<IPage<{ email: string }>>('/api/users?search=luis');
      expect(found.data.map((u) => u.email)).toEqual(['luis@ticketit.dev']);
    });

    it('cambiar el rol rige en la siguiente carga del shell de esa persona', async () => {
      await send('patch', `/api/users/${VICTOR}/role`, { role: 'AGENT' });
      await store.signOut();
      await store.signInAs(EUserRole.VIEWER); // entra como Víctor, que ahora es AGENT
      expect(store.$role()).toBe(EUserRole.AGENT);
      expect(ability.can('create', 'Ticket')).toBe(true);
    });

    it('rechaza campos extra y roles inválidos (400); 404 si no existe', async () => {
      expect(await codeOf(send('patch', `/api/users/${VICTOR}/role`, { role: 'AGENT', extra: 1 }))).toBe('CVAL-E001');
      expect(await codeOf(send('patch', `/api/users/${VICTOR}/role`, { role: 'NOPE' }))).toBe('CVAL-E001');
      expect(await codeOf(get('/api/users/00000000-0000-4000-8000-000000000000'))).toBe('SUSR-E002');
    });

    it('nadie cambia su propio rol ni se deshabilita (SUSR-E003); repetir el valor es idempotente', async () => {
      expect(await codeOf(send('patch', `/api/users/${MARTA}/role`, { role: 'VIEWER' }))).toBe('SUSR-E003');
      expect(await codeOf(send('patch', `/api/users/${MARTA}/status`, { disabled: true }))).toBe('SUSR-E003');
      await send('patch', `/api/users/${MARTA}/role`, { role: 'ADMIN' });
    });

    it('deshabilitar impide volver a entrar (mismo 401 genérico) y habilitar lo permite', async () => {
      await send('patch', `/api/users/${VICTOR}/status`, { disabled: true });
      await store.signOut();
      expect(await codeOf(store.signIn({ email: 'victor@ticketit.dev', password: 'ticketit-dev' }))).toBe('SAUT-E004');

      await store.signInAs(EUserRole.ADMIN);
      await send('patch', `/api/users/${VICTOR}/status`, { disabled: false });
      await store.signOut();
      await store.signIn({ email: 'victor@ticketit.dev', password: 'ticketit-dev' });
      expect(store.$isAuthenticated()).toBe(true);
    });
  });

  describe('permisos por rol', () => {
    beforeEach(() => store.signInAs(EUserRole.ADMIN));
    // El cliente ya puede crear; se le concede LEER todo (permiso extra) para ver el efecto.
    const rule = { role: 'VIEWER', subject: 'Ticket', action: 'read', condition: 'NONE' };

    it('conceder un permiso lo refleja la siguiente sesión de ese rol; quitarlo lo revierte', async () => {
      const created = (await send('post', '/api/role-permissions', rule)) as { uuid: string };
      await store.signOut();
      await store.signInAs(EUserRole.VIEWER);
      expect(ability.can('read', subject('Ticket', { ownerUuid: 'otra-persona' }))).toBe(true);

      await store.signOut();
      await store.signInAs(EUserRole.ADMIN);
      await send('delete', `/api/role-permissions/${created.uuid}`);
      await store.signOut();
      await store.signInAs(EUserRole.VIEWER);
      // Sin el permiso por rol solo queda la regla de titular: lee ÚNICAMENTE lo suyo.
      expect(ability.can('read', subject('Ticket', { ownerUuid: 'otra-persona' }))).toBe(false);
    });

    it('duplicado 409 RRPM-E002, inválido 400, inexistente 404', async () => {
      await send('post', '/api/role-permissions', rule);
      expect(await codeOf(send('post', '/api/role-permissions', rule))).toBe('RRPM-E002');
      expect(await codeOf(send('post', '/api/role-permissions', { ...rule, role: 'NOPE' }))).toBe('CVAL-E001');
      expect(await codeOf(get('/api/role-permissions/00000000-0000-4000-8000-000000000000'))).toBe('RRPM-E001');
    });
  });

  describe('menú', () => {
    beforeEach(() => store.signInAs(EUserRole.ADMIN));
    const item = { key: 'reports', label: 'Reportes', route: '/reports', group: 'Tickets', icon: null, subject: null, requiredAction: null, order: 15, active: true };

    it('crear y ocultar un ítem se refleja en el shell; las rutas externas se rechazan', async () => {
      const created = (await send('post', '/api/menu-items', item)) as { uuid: string };
      const keys = async () => ((await get<{ menu: { key: string }[] }>('/api/bff/shell')).menu.map((m) => m.key));
      expect(await keys()).toContain('reports');

      await send('patch', `/api/menu-items/${created.uuid}`, { ...item, active: false });
      expect(await keys()).not.toContain('reports');

      for (const route of ['//evil.com', 'https://evil.com', 'tickets']) {
        expect(await codeOf(send('post', '/api/menu-items', { ...item, key: 'otro', route }))).toBe('CVAL-E001');
      }
      expect(await codeOf(send('post', '/api/menu-items', { ...item, key: 'board' }))).toBe('RMNU-E002');
    });
  });

  describe('catálogos', () => {
    it('cualquier sesión lee las opciones; lo de sistema conserva código y no se elimina', async () => {
      await store.signInAs(EUserRole.VIEWER);
      const options = await get<{ data: { value: string }[] }>('/api/catalogs/ticket-priority/options');
      expect(options.data.map((o) => o.value)).toEqual(['low', 'medium', 'high', 'critical']);

      await store.signOut();
      await store.signInAs(EUserRole.ADMIN);
      const detail = await get<{ items: { uuid: string; code: string; label: string; order: number }[] }>('/api/catalogs/ticket-category');
      const bug = detail.items.find((i) => i.code === 'hardware')!;
      const url = `/api/catalogs/ticket-category/items/${bug.uuid}`;
      expect(await codeOf(send('patch', url, { code: 'defecto', label: 'Error', order: 10, active: true }))).toBe('RCAT-E004');
      expect(await codeOf(send('delete', url))).toBe('RCAT-E004');
      expect(await codeOf(send('delete', '/api/catalogs/ticket-category'))).toBe('RCAT-E004');
      await send('patch', url, { code: 'hardware', label: 'Equipos', order: 5, active: true, icon: '', severity: '' });
    });

    it('un catálogo propio se crea, se llena y se elimina; códigos repetidos 409', async () => {
      await store.signInAs(EUserRole.ADMIN);
      await send('post', '/api/catalogs', { key: 'sedes', name: 'Sedes', description: '' });
      await send('post', '/api/catalogs/sedes/items', { code: 'NORTE', label: 'Norte', order: 10, active: true });
      expect(await codeOf(send('post', '/api/catalogs/sedes/items', { code: 'norte', label: 'Otra', order: 20, active: true }))).toBe('RCAT-E003');
      expect(await codeOf(send('post', '/api/catalogs', { key: 'Mala Clave', name: 'X', description: '' }))).toBe('CVAL-E001');
      await send('delete', '/api/catalogs/sedes');
      expect(await codeOf(get('/api/catalogs/sedes'))).toBe('RCAT-E001');
    });
  });

  describe('auditoría', () => {
    it('registra mutaciones, también las denegadas, con nombres de campos y sin valores', async () => {
      await store.signInAs(EUserRole.AGENT);
      await codeOf(send('patch', `/api/users/${VICTOR}/role`, { role: 'ADMIN' })); // 403
      await store.signOut();
      await store.signInAs(EUserRole.ADMIN);
      await send('patch', `/api/users/${VICTOR}/role`, { role: 'AGENT' });

      const log = (await get<IPage<IAuditRow>>('/api/audit-logs?take=50')).data;
      const denied = log.find((e) => e.outcome === 'DENIED' && e.route === '/api/users/:uuid/role');
      expect(denied?.actorEmail).toBe('ana@ticketit.dev');
      const done = log.find((e) => e.outcome === 'SUCCESS' && e.route === '/api/users/:uuid/role');
      expect(done).toMatchObject({ action: 'UPDATE', actorEmail: 'marta@ticketit.dev', changedFields: ['role'] });
      expect(JSON.stringify(log)).not.toContain('ticketit-dev'); // la contraseña de los inicios de sesión
      expect(log.some((e) => e.action === 'SIGN_IN')).toBe(true);
    });

    it('es de solo lectura y filtra por resultado', async () => {
      await store.signInAs(EUserRole.ADMIN);
      expect(await codeOf(send('post', '/api/audit-logs', {}))).toBe('NEST-E405');
      expect(await codeOf(send('delete', '/api/audit-logs/00000000-0000-4000-8000-000000000000'))).toBe('NEST-E405');
      const denied = await get<IPage<IAuditRow>>('/api/audit-logs?outcome=DENIED');
      expect(denied.data.every((e) => e.outcome === 'DENIED')).toBe(true);
    });
  });

  describe('compartir (relaciones)', () => {
    const share = { alternanteEmail: 'victor@ticketit.dev', grants: [{ objectType: 'Ticket', canRead: true, canUpdate: false, canDelete: false, notifyTitular: true }], consent: true };

    it('sin consentimiento 400; consigo mismo 422; inexistente 422; duplicado 409', async () => {
      await store.signInAs(EUserRole.AGENT);
      expect(await codeOf(send('post', '/api/relationships', { ...share, consent: false }))).toBe('CVAL-E001');
      expect(await codeOf(send('post', '/api/relationships', { ...share, alternanteEmail: 'ana@ticketit.dev' }))).toBe('SREL-E001');
      expect(await codeOf(send('post', '/api/relationships', { ...share, alternanteEmail: 'nadie@ticketit.dev' }))).toBe('SREL-E002');
      await send('post', '/api/relationships', share);
      expect(await codeOf(send('post', '/api/relationships', share))).toBe('SREL-E003');
    });

    it('lo compartido llega al alternante como regla ReBAC y revocar la quita; el alternante no la cambia', { timeout: 30_000 }, async () => {
      await store.signInAs(EUserRole.AGENT);
      const created = (await send('post', '/api/relationships', share)) as { uuid: string };
      await store.signOut();

      await store.signInAs(EUserRole.VIEWER);
      const mine = await get<{ myRole: string }[]>('/api/relationships');
      expect(mine.map((r) => r.myRole)).toEqual(['ALTERNANTE']);
      expect(await codeOf(send('delete', `/api/relationships/${created.uuid}`))).toBe('SREL-E004');
      const rebac = (store.$user() && ability.rules.some((r) => JSON.stringify(r.conditions ?? {}).includes('$in')));
      expect(rebac).toBe(true);

      await store.signOut();
      await store.signInAs(EUserRole.AGENT);
      await send('delete', `/api/relationships/${created.uuid}`);
      await store.signOut();
      await store.signInAs(EUserRole.VIEWER);
      expect(ability.rules.some((r) => JSON.stringify(r.conditions ?? {}).includes('$in'))).toBe(false);
    });
  });

  describe('relaciones (administración)', () => {
    const share = { alternanteEmail: 'victor@ticketit.dev', grants: [{ objectType: 'Ticket', canRead: true, canUpdate: true, canDelete: false, notifyTitular: true }], consent: true };

    it('un titular común no entra (403); ADMIN ve las de todos y revoca, y el alternante pierde el acceso', { timeout: 40_000 }, async () => {
      await store.signInAs(EUserRole.AGENT);
      const created = (await send('post', '/api/relationships', share)) as { uuid: string };
      expect(await codeOf(get('/api/relationships/admin'))).toBe('SAUT-E001');
      await store.signOut();

      await store.signInAs(EUserRole.ADMIN);
      const all = await get<IPage<{ titularEmail: string; alternanteName: string; status: string; canUpdate: boolean }>>('/api/relationships/admin');
      expect(all.data).toEqual([expect.objectContaining({ titularEmail: 'ana@ticketit.dev', alternanteName: 'Víctor Lector', status: 'ACTIVE', canUpdate: true })]);
      await send('delete', `/api/relationships/admin/${created.uuid}`);
      const history = await get<IPage<{ status: string }>>('/api/relationships/admin?status=REVOKED');
      expect(history.data.map((r) => r.status)).toEqual(['REVOKED']);
      expect(await codeOf(send('delete', `/api/relationships/admin/${created.uuid}`))).toBe('RREL-E001');

      await store.signOut();
      await store.signInAs(EUserRole.VIEWER);
      expect(ability.rules.some((r) => JSON.stringify(r.conditions ?? {}).includes('$in'))).toBe(false);
    });
  });
});

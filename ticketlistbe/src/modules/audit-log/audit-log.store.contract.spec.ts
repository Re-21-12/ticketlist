import { randomUUID } from 'node:crypto';
import type { IAuditLog } from './audit-log.entity.js';
import type { IAuditLogStore } from './audit-log.store.js';
import { MemoryAuditLogStore } from './memory-audit-log.store.js';
import { PostgresAuditLogStore } from './postgres-audit-log.store.js';

/**
 * Contrato del registro de auditoría: la MISMA batería corre contra memoria y, si `DATABASE_URL` está
 * definido, contra Postgres real. Si los dos pasan, son intercambiables.
 */
const adapters: [string, () => Promise<IAuditLogStore>, boolean][] = [
  ['MemoryAuditLogStore', () => Promise.resolve(new MemoryAuditLogStore()), true],
  ['PostgresAuditLogStore', () => PostgresAuditLogStore.connect(process.env['DATABASE_URL'] ?? ''), !!process.env['DATABASE_URL']],
];

describe.each(adapters)('IAuditLogStore · %s', (_name, create, enabled) => {
  let store: IAuditLogStore;
  /** Marca única por corrida: filtra SOLO lo de esta prueba aunque la tabla tenga más filas. */
  const tag = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const entry = (over: Partial<IAuditLog> = {}): IAuditLog => ({
    uuid: randomUUID(),
    at: new Date(),
    action: 'UPDATE',
    subject: tag,
    route: `/api/${tag}/:uuid`,
    method: 'PATCH',
    resourceUuid: null,
    status: 200,
    outcome: 'SUCCESS',
    actorUuid: null,
    actorEmail: 'marta@ticketit.dev',
    actorRole: 'ADMIN',
    ip: '127.0.0.1',
    userAgent: 'vitest',
    requestId: null,
    changedFields: ['role'],
    ...over,
  });

  beforeAll(async () => {
    if (enabled) store = await create();
  });
  afterAll(async () => {
    if (enabled) await store.close();
  });

  it('el contrato es append-only: solo expone append y lecturas (nada que actualice o borre)', () => {
    const prototype = _name === 'MemoryAuditLogStore' ? MemoryAuditLogStore.prototype : PostgresAuditLogStore.prototype;
    const methods = Object.getOwnPropertyNames(prototype).filter((method) => method !== 'constructor');
    expect(methods.toSorted()).toEqual(['append', 'close', 'findAll', 'findByUuid']);
  });

  it.skipIf(!enabled)('guarda y devuelve la entrada completa por uuid', async () => {
    const saved = entry({ resourceUuid: randomUUID(), changedFields: ['role', 'disabled'] });
    await store.append(saved);
    expect(await store.findByUuid(saved.uuid)).toEqual(saved);
    expect(await store.findByUuid(randomUUID())).toBeNull();
  });

  it.skipIf(!enabled)('lista de más nuevo a más viejo, con filtros y paginación', async () => {
    const base = Date.now();
    await store.append(entry({ at: new Date(base - 3000), action: 'CREATE', outcome: 'SUCCESS', actorUuid: 'a-1' }));
    await store.append(entry({ at: new Date(base - 2000), action: 'DELETE', outcome: 'DENIED', status: 403 }));
    await store.append(entry({ at: new Date(base - 1000), action: 'UPDATE', outcome: 'FAILED', status: 400 }));

    const [all, total] = await store.findAll({ subject: tag, page: 1, take: 50 });
    expect(total).toBeGreaterThanOrEqual(3);
    const times = all.map((e) => e.at.getTime());
    expect(times).toEqual(times.toSorted((a, b) => b - a));

    const [denied] = await store.findAll({ subject: tag, outcome: 'DENIED', page: 1, take: 50 });
    expect(denied.length).toBe(1);
    expect(denied[0]?.action).toBe('DELETE');
    const [mine] = await store.findAll({ subject: tag, actorUuid: 'a-1', page: 1, take: 50 });
    expect(mine.map((e) => e.action)).toEqual(['CREATE']);
    const [range] = await store.findAll({ subject: tag, from: new Date(base - 2500), to: new Date(base - 1500), page: 1, take: 50 });
    expect(range.map((e) => e.action)).toEqual(['DELETE']);

    const [page1, count] = await store.findAll({ subject: tag, page: 1, take: 2 });
    const [page2] = await store.findAll({ subject: tag, page: 2, take: 2 });
    expect(page1).toHaveLength(2);
    expect(page2.length).toBeGreaterThanOrEqual(1);
    expect(count).toBe(total);
    expect(page2[0]?.uuid).not.toBe(page1[0]?.uuid);
  });

  it.skipIf(!enabled)('la búsqueda es de texto LITERAL (un % o _ no es comodín)', async () => {
    await store.append(entry({ actorEmail: `buscar_${tag}@x.dev` }));
    const [exact] = await store.findAll({ subject: tag, search: `buscar_${tag}`, page: 1, take: 10 });
    expect(exact.length).toBe(1);
    const [wild] = await store.findAll({ subject: tag, search: '%', page: 1, take: 10 });
    expect(wild.length).toBe(0);
  });
});

import type { IKeyValueStore } from './kv-store.interface.js';
import { MemoryKvStore } from './memory-kv.store.js';
import { RedisKvStore } from './redis-kv.store.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Contrato del almacén clave-valor: la MISMA batería corre contra el adaptador en memoria y, si
 * `REDIS_URL` está definido, contra Redis real. Si los dos pasan, son intercambiables.
 */
const adapters: [string, () => Promise<IKeyValueStore>, boolean][] = [
  ['MemoryKvStore', () => Promise.resolve(new MemoryKvStore()), true],
  ['RedisKvStore', () => RedisKvStore.connect(process.env['REDIS_URL'] ?? ''), !!process.env['REDIS_URL']],
];

describe.each(adapters)('IKeyValueStore · %s', (_name, create, enabled) => {
  let store: IKeyValueStore;
  /** Prefijo único por corrida: no se pisa con otras ejecuciones ni deja basura que importe. */
  const ns = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}:`;
  const k = (name: string) => ns + name;

  beforeAll(async () => {
    if (enabled) store = await create();
  });
  afterAll(async () => {
    if (enabled) await store.close();
  });

  it.skipIf(!enabled)('set/get/del', async () => {
    await store.set(k('a'), 'hola');
    expect(await store.get(k('a'))).toBe('hola');
    await store.del(k('a'));
    expect(await store.get(k('a'))).toBeNull();
  });

  it.skipIf(!enabled)('getDel consume el valor UNA sola vez', async () => {
    await store.set(k('token'), 'secreto', 60);
    expect(await store.getDel(k('token'))).toBe('secreto');
    expect(await store.getDel(k('token'))).toBeNull();
  });

  it.skipIf(!enabled)('expira por TTL', async () => {
    await store.set(k('corto'), 'x', 1);
    expect(await store.get(k('corto'))).toBe('x');
    await sleep(1200);
    expect(await store.get(k('corto'))).toBeNull();
  });

  it.skipIf(!enabled)('incrWithTtl: cuenta y la ventana es FIJA (no se extiende)', async () => {
    expect(await store.incrWithTtl(k('c'), 60)).toBe(1);
    const ttl1 = await store.ttl(k('c'));
    expect(ttl1).toBeGreaterThan(0);
    await sleep(1100);
    expect(await store.incrWithTtl(k('c'), 60)).toBe(2);
    // Si el segundo incremento hubiera reiniciado el TTL, volvería a ~60.
    expect(await store.ttl(k('c'))).toBeLessThan(ttl1);
  });

  it.skipIf(!enabled)('ttl: -2 si no existe, -1 sin expiración', async () => {
    expect(await store.ttl(k('nope'))).toBe(-2);
    await store.set(k('perm'), 'x');
    expect(await store.ttl(k('perm'))).toBe(-1);
  });

  it.skipIf(!enabled)('conjuntos (índice de sesiones por usuario)', async () => {
    await store.sAdd(k('set'), 'a');
    await store.sAdd(k('set'), 'b');
    await store.sAdd(k('set'), 'a');
    expect((await store.sMembers(k('set'))).sort()).toEqual(['a', 'b']);
    await store.sRem(k('set'), 'a');
    expect(await store.sMembers(k('set'))).toEqual(['b']);
  });

  it.skipIf(!enabled)('pub/sub entrega a los suscriptores y deja de entregar al cancelar', async () => {
    const received: string[] = [];
    const unsubscribe = await store.subscribe(k('canal'), (message) => received.push(message));
    await store.publish(k('canal'), 'uno');
    await sleep(100);
    expect(received).toEqual(['uno']);
    await unsubscribe();
    await store.publish(k('canal'), 'dos');
    await sleep(100);
    expect(received).toEqual(['uno']);
  });

  it.skipIf(!enabled)('ping', async () => {
    expect(await store.ping()).toBe(true);
  });
});

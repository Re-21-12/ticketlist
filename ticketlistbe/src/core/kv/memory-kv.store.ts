import { EventEmitter } from 'node:events';
import type { IKeyValueStore, TKvMessageHandler } from './kv-store.interface.js';

interface IEntry {
  value: string;
  /** `null` = sin expiración. */
  expiresAt: number | null;
}

/**
 * Adaptador EN MEMORIA: un solo proceso, se pierde al reiniciar. Suficiente para desarrollo y
 * tests; en producción `loadEnv()` exige `REDIS_URL`. Expira de forma perezosa (al leer).
 */
export class MemoryKvStore implements IKeyValueStore {
  readonly kind = 'memory' as const;
  private readonly entries = new Map<string, IEntry>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly bus = new EventEmitter();

  constructor() {
    // Muchos streams SSE = muchos listeners legítimos en un mismo canal.
    this.bus.setMaxListeners(0);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  getDel(key: string): Promise<string | null> {
    const entry = this.live(key);
    this.entries.delete(key);
    return Promise.resolve(entry?.value ?? null);
  }

  del(key: string): Promise<void> {
    this.entries.delete(key);
    this.sets.delete(key);
    return Promise.resolve();
  }

  incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const current = this.live(key);
    const count = current ? Number(current.value) + 1 : 1;
    this.entries.set(key, {
      value: String(count),
      // Solo el primer incremento fija el TTL.
      expiresAt: current ? current.expiresAt : Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve(count);
  }

  ttl(key: string): Promise<number> {
    const entry = this.live(key);
    if (!entry) return Promise.resolve(-2);
    if (entry.expiresAt === null) return Promise.resolve(-1);
    return Promise.resolve(Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)));
  }

  sAdd(key: string, member: string): Promise<void> {
    const members = this.sets.get(key) ?? new Set<string>();
    members.add(member);
    this.sets.set(key, members);
    return Promise.resolve();
  }

  sRem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
    return Promise.resolve();
  }

  sMembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  publish(channel: string, message: string): Promise<void> {
    this.bus.emit(channel, message);
    return Promise.resolve();
  }

  subscribe(channel: string, handler: TKvMessageHandler): Promise<() => Promise<void>> {
    this.bus.on(channel, handler);
    return Promise.resolve(() => {
      this.bus.off(channel, handler);
      return Promise.resolve();
    });
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    this.bus.removeAllListeners();
    return Promise.resolve();
  }

  private live(key: string): IEntry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
}

import { createClient } from 'redis';
import type { IKeyValueStore, TKvMessageHandler } from './kv-store.interface.js';

/** Prefijo por defecto: así Ticketit convive con otras apps en el mismo Redis (`REDIS_KEY_PREFIX` lo cambia). */
export const DEFAULT_KV_PREFIX = 'ticketit:';

export type TRedisClient = ReturnType<typeof createClient>;

/** Adaptador Redis (producción). Dos conexiones: una de comandos y otra de suscripción. */
export class RedisKvStore implements IKeyValueStore {
  readonly kind = 'redis' as const;

  private constructor(
    readonly client: TRedisClient,
    private readonly subscriber: TRedisClient,
    readonly prefix: string,
  ) {}

  static async connect(url: string, prefix: string = DEFAULT_KV_PREFIX): Promise<RedisKvStore> {
    const client = createClient({ url }) as unknown as TRedisClient;
    // Sin listener, un error de red tumba el proceso (EventEmitter 'error' sin manejar).
    client.on('error', () => undefined);
    await client.connect();
    const subscriber = client.duplicate() as unknown as TRedisClient;
    subscriber.on('error', () => undefined);
    await subscriber.connect();
    return new RedisKvStore(client, subscriber, prefix);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.client.set(this.prefix + key, value, ttlSeconds ? { EX: ttlSeconds } : undefined);
  }

  get(key: string): Promise<string | null> {
    return this.client.get(this.prefix + key);
  }

  getDel(key: string): Promise<string | null> {
    return this.client.getDel(this.prefix + key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.prefix + key);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(this.prefix + key);
    if (count === 1) await this.client.expire(this.prefix + key, ttlSeconds);
    return count;
  }

  ttl(key: string): Promise<number> {
    return this.client.ttl(this.prefix + key);
  }

  async sAdd(key: string, member: string): Promise<void> {
    await this.client.sAdd(this.prefix + key, member);
  }

  async sRem(key: string, member: string): Promise<void> {
    await this.client.sRem(this.prefix + key, member);
  }

  sMembers(key: string): Promise<string[]> {
    return this.client.sMembers(this.prefix + key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(this.prefix + channel, message);
  }

  async subscribe(channel: string, handler: TKvMessageHandler): Promise<() => Promise<void>> {
    const name = this.prefix + channel;
    await this.subscriber.subscribe(name, handler);
    return async () => {
      await this.subscriber.unsubscribe(name, handler);
    };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}

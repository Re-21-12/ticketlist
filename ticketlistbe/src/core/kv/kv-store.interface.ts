/** Token de inyección del almacén clave-valor. */
export const KV_STORE = Symbol('KV_STORE');

export type TKvMessageHandler = (message: string) => void;

/**
 * Puerto del almacén clave-valor efímero (sesiones, contadores de rate limit, tokens de un solo
 * uso, pub/sub). Dos adaptadores: `MemoryKvStore` (desarrollo y tests) y `RedisKvStore`
 * (producción). Los servicios dependen de ESTA interfaz, nunca de Redis.
 */
export interface IKeyValueStore {
  readonly kind: 'memory' | 'redis';

  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Lee y borra en una sola operación atómica: el token se consume UNA vez (`GETDEL`). */
  getDel(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  /** Incrementa; el TTL se fija SOLO en el primer incremento (ventana fija, no deslizante). */
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  /** Segundos que faltan: `-1` sin expiración, `-2` no existe (igual que `TTL` de Redis). */
  ttl(key: string): Promise<number>;

  sAdd(key: string, member: string): Promise<void>;
  sRem(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;

  publish(channel: string, message: string): Promise<void>;
  /** Devuelve la función que cancela la suscripción. */
  subscribe(channel: string, handler: TKvMessageHandler): Promise<() => Promise<void>>;

  ping(): Promise<boolean>;
  close(): Promise<void>;
}

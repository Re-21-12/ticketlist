import { Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { CustomBusinessException } from '../exceptions/app.exception.js';
import { KV_STORE, type IKeyValueStore } from '../kv/kv-store.interface.js';

export interface IRateLimitRule {
  /** Identifica el recurso protegido + a quién se cuenta: `login:acct:ana@x.dev`. */
  key: string;
  /** Intentos permitidos dentro de la ventana. */
  limit: number;
  windowSeconds: number;
}

export interface IRateLimitState {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Segundos hasta que la ventana se reinicia. */
  resetSeconds: number;
}

const KEY_PREFIX = 'rl:';

/**
 * Contador de ventana FIJA sobre el almacén clave-valor (el primer intento fija el TTL; los
 * siguientes no lo extienden). Dos usos (docs/design/auth-flows.md §7):
 *  - por IP, vía `RateLimitGuard` (global).
 *  - por CUENTA, desde los servicios de autenticación (`assertAllowed` + `recordFailure`/`reset`):
 *    frena el adivinar la contraseña de UNA cuenta desde muchas IPs.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(KV_STORE) private readonly kv: IKeyValueStore) {}

  /** Cuenta UN intento y dice si sigue permitido. Para el guard por IP (cuenta toda request). */
  async consume(rule: IRateLimitRule): Promise<IRateLimitState> {
    const count = await this.kv.incrWithTtl(KEY_PREFIX + rule.key, rule.windowSeconds);
    return this.state(rule, count);
  }

  /** Lanza 429 si la cuenta ya agotó sus intentos, SIN contar uno nuevo (solo se cuentan fallos). */
  async assertAllowed(rule: IRateLimitRule): Promise<void> {
    const count = Number((await this.kv.get(KEY_PREFIX + rule.key)) ?? 0);
    const state = this.state(rule, count);
    if (count >= rule.limit) throw await this.tooMany(rule, state);
  }

  /** Registra un intento fallido; si con él se agota el límite, el SIGUIENTE será 429. */
  async recordFailure(rule: IRateLimitRule): Promise<void> {
    await this.kv.incrWithTtl(KEY_PREFIX + rule.key, rule.windowSeconds);
  }

  /** Tras un éxito el contador de esa cuenta se reinicia. */
  async reset(rule: Pick<IRateLimitRule, 'key'>): Promise<void> {
    await this.kv.del(KEY_PREFIX + rule.key);
  }

  async tooMany(rule: IRateLimitRule, state?: IRateLimitState): Promise<CustomBusinessException> {
    const ttl = await this.kv.ttl(KEY_PREFIX + rule.key);
    const retryAfterSeconds = ttl > 0 ? ttl : (state?.resetSeconds ?? rule.windowSeconds);
    return new CustomBusinessException(ERROR_CODES.RATE.TOO_MANY_REQUESTS, { retryAfterSeconds });
  }

  private state(rule: IRateLimitRule, count: number): IRateLimitState {
    return {
      allowed: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetSeconds: rule.windowSeconds,
    };
  }
}

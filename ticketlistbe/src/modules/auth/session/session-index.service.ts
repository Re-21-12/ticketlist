import { Inject, Injectable } from '@nestjs/common';
import type { SessionData, Store } from 'express-session';
import { createHash } from 'node:crypto';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { KV_STORE, type IKeyValueStore } from '../../../core/kv/kv-store.interface.js';
import type { TSessionInfo } from '../dtos/session-info.dto.js';

/** Un índice por usuario: express-session solo indexa por `sid`, no sabe «las sesiones de Ana». */
const INDEX_PREFIX = 'user-sessions:';

/** Id público de una sesión: hash corto del `sid` (nunca el `sid`, que es el secreto de la cookie). */
export function publicSessionId(sid: string): string {
  return createHash('sha256').update(sid).digest('base64url').slice(0, 16);
}

const getSession = (store: Store, sid: string): Promise<SessionData | null> =>
  new Promise((resolve, reject) =>
    store.get(sid, (error, data) => (error ? reject(error as Error) : resolve(data ?? null))),
  );

const destroySession = (store: Store, sid: string): Promise<void> =>
  new Promise((resolve, reject) =>
    store.destroy(sid, (error) => (error ? reject(error as Error) : resolve())),
  );

/**
 * Índice secundario `usuario → sids` sobre el almacén clave-valor, para listar y revocar sesiones por
 * usuario (equivale a `SessionIndexService` de wallet-api). Las sesiones que ya vencieron se podan
 * perezosamente al listar: el índice no se entera de que expiraron.
 */
@Injectable()
export class SessionIndexService {
  constructor(@Inject(KV_STORE) private readonly kv: IKeyValueStore) {}

  track(userUuid: string, sid: string): Promise<void> {
    return this.kv.sAdd(INDEX_PREFIX + userUuid, sid);
  }

  untrack(userUuid: string, sid: string): Promise<void> {
    return this.kv.sRem(INDEX_PREFIX + userUuid, sid);
  }

  /** Sesiones VIVAS del usuario, la actual primero y luego de más reciente a más antigua. */
  async listFor(userUuid: string, currentSid: string, store: Store): Promise<TSessionInfo[]> {
    const sessions: TSessionInfo[] = [];
    for (const sid of await this.kv.sMembers(INDEX_PREFIX + userUuid)) {
      const data = await getSession(store, sid);
      // Vencida, destruida, o de OTRO usuario (no debería): se poda y no se muestra.
      if (data?.userUuid !== userUuid) {
        await this.untrack(userUuid, sid);
        continue;
      }
      sessions.push({
        id: publicSessionId(sid),
        current: sid === currentSid,
        ipAddress: data.ip ?? 'desconocida',
        userAgent: data.userAgent ?? '',
        createdAt: new Date(data.authenticatedAt ?? 0).toISOString(),
        expiresAt: data.cookie.expires ? new Date(data.cookie.expires).toISOString() : null,
      });
    }
    return sessions.sort(
      (a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt),
    );
  }

  /** Cierra UNA sesión ajena a la actual. 404 si no es del usuario (no se revela que existe). */
  async revoke(userUuid: string, id: string, currentSid: string, store: Store): Promise<void> {
    const sids = await this.kv.sMembers(INDEX_PREFIX + userUuid);
    const sid = sids.find((candidate) => publicSessionId(candidate) === id);
    if (!sid) throw new CustomBusinessException(ERROR_CODES.SES.NOT_FOUND);
    if (sid === currentSid) throw new CustomBusinessException(ERROR_CODES.SES.IS_CURRENT);
    await destroySession(store, sid);
    await this.untrack(userUuid, sid);
  }

  /** Cierra todas menos la actual (botón «Cerrar las demás» y cambio de contraseña). Devuelve cuántas. */
  async revokeOthers(userUuid: string, currentSid: string, store: Store): Promise<number> {
    let closed = 0;
    for (const sid of await this.kv.sMembers(INDEX_PREFIX + userUuid)) {
      if (sid === currentSid) continue;
      await destroySession(store, sid);
      await this.untrack(userUuid, sid);
      closed += 1;
    }
    return closed;
  }
}

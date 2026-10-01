import { AsyncLocalStorage } from 'node:async_hooks';
import type { ISessionUser } from '../../modules/auth/session/session-user.interface.js';

interface IRequestStore {
  user: ISessionUser | null;
  /** Header `If-Match` de la request (concurrencia optimista, RFC 9110 §13.1.1). */
  ifMatch: string | null;
}

const storage = new AsyncLocalStorage<IRequestStore>();

/**
 * Contexto por request (lo que en wallet-api hace `nestjs-cls`): servicio y guards leen el usuario
 * de la sesión y el `If-Match` sin recibirlos por parámetro. `AsyncLocalStorage` es nativo de Node.
 * Lo llena `SessionContextMiddleware`.
 */
export const RequestContext = {
  run<T>(store: IRequestStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  currentUser(): ISessionUser | null {
    return storage.getStore()?.user ?? null;
  },
  ifMatch(): string | null {
    return storage.getStore()?.ifMatch ?? null;
  },
};

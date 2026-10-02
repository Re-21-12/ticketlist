import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import { AUDIT_STORE, type IAuditLogStore } from './audit-log.store.js';
import { AuditMiddleware } from './audit.middleware.js';
import { MemoryAuditLogStore } from './memory-audit-log.store.js';
import { PostgresAuditLogStore } from './postgres-audit-log.store.js';

/** Dominio. Global: `AppModule` registra `AuditMiddleware` para toda mutación. Adaptador según `DATABASE_URL`. */
@Global()
@Module({
  providers: [
    {
      provide: AUDIT_STORE,
      inject: [APP_ENV],
      useFactory: async (env: TEnv): Promise<IAuditLogStore> =>
        env.DATABASE_URL ? PostgresAuditLogStore.connect(env.DATABASE_URL) : new MemoryAuditLogStore(),
    },
    AuditMiddleware,
  ],
  exports: [AUDIT_STORE, AuditMiddleware],
})
export class AuditLogModule implements OnApplicationShutdown {
  constructor(@Inject(AUDIT_STORE) private readonly store: IAuditLogStore) {}

  async onApplicationShutdown(): Promise<void> {
    await this.store.close();
  }
}

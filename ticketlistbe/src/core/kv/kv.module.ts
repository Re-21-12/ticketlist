import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import { KV_STORE, type IKeyValueStore } from './kv-store.interface.js';
import { MemoryKvStore } from './memory-kv.store.js';
import { RedisKvStore } from './redis-kv.store.js';

/** Elige el adaptador según `REDIS_URL` y lo cierra al apagar (graceful shutdown). */
@Global()
@Module({
  providers: [
    {
      provide: KV_STORE,
      inject: [APP_ENV],
      useFactory: async (env: TEnv): Promise<IKeyValueStore> =>
        env.REDIS_URL ? RedisKvStore.connect(env.REDIS_URL, env.REDIS_KEY_PREFIX) : new MemoryKvStore(),
    },
  ],
  exports: [KV_STORE],
})
export class KvModule implements OnApplicationShutdown {
  constructor(@Inject(KV_STORE) private readonly store: IKeyValueStore) {}

  async onApplicationShutdown(): Promise<void> {
    await this.store.close();
  }
}

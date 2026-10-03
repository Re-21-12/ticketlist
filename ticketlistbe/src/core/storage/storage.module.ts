import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import { MemoryObjectStorage } from './memory-object-storage.js';
import { OBJECT_STORAGE, type IObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/**
 * Elige el almacén por entorno: con `S3_ENDPOINT` (y sus claves) el bucket MinIO/S3; sin él, memoria (desarrollo y pruebas).
 * `loadEnv` exige el bucket en production: la evidencia no puede perderse al reiniciar.
 */
@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [APP_ENV],
      useFactory: (env: TEnv): IObjectStorage =>
        env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? new S3ObjectStorage({
              endPoint: env.S3_ENDPOINT,
              port: env.S3_PORT,
              useSSL: env.S3_USE_SSL,
              accessKey: env.S3_ACCESS_KEY,
              secretKey: env.S3_SECRET_KEY,
              bucket: env.S3_BUCKET,
              ...(env.S3_REGION ? { region: env.S3_REGION } : {}),
            })
          : new MemoryObjectStorage(),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}

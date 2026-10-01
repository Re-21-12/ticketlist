import { Global, Module } from '@nestjs/common';
import { loadEnv, type TEnv } from './env.schema.js';

/** Token de inyección del entorno YA validado (`loadEnv`): los servicios no leen `process.env`. */
export const APP_ENV = Symbol('APP_ENV');

@Global()
@Module({
  providers: [{ provide: APP_ENV, useFactory: (): TEnv => loadEnv() }],
  exports: [APP_ENV],
})
export class AppConfigModule {}

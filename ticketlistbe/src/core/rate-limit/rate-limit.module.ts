import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';

/**
 * Se importa PRIMERO en `AppModule`: Nest ejecuta los `APP_GUARD` en el orden en que se
 * registran, y el límite por IP debe correr antes que SessionAuthGuard.
 */
@Global()
@Module({
  providers: [RateLimitService, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimitService],
})
export class RateLimitModule {}

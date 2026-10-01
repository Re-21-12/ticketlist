import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
  type IRateLimitOptions,
} from './rate-limit.decorator.js';
import { RateLimitService, type IRateLimitRule } from './rate-limit.service.js';

const GLOBAL_WINDOW_SECONDS = 60;

/**
 * Límite por IP, GLOBAL y el PRIMERO de la cadena de guards (antes de la sesión: así una ráfaga
 * sin sesión también se frena). Cabeceras `RateLimit-*` (IETF draft-ietf-httpapi-ratelimit-headers)
 * en cada respuesta y `Retry-After` en el 429 (RFC 9110 §10.2.3, lo agrega el filtro).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly reflector: Reflector,
    @Inject(APP_ENV) private readonly env: TEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const own = this.reflector.getAllAndOverride<IRateLimitOptions | undefined>(RATE_LIMIT_KEY, targets);

    const ip = request.ip ?? 'unknown';
    const rule: IRateLimitRule = own
      ? {
          key: `route:${context.getClass().name}.${context.getHandler().name}:${ip}`,
          limit: own.limit,
          windowSeconds: own.windowSeconds,
        }
      : { key: `global:${ip}`, limit: this.env.RATE_LIMIT_GLOBAL_PER_MIN, windowSeconds: GLOBAL_WINDOW_SECONDS };

    const state = await this.rateLimit.consume(rule);
    response.setHeader('RateLimit-Limit', String(state.limit));
    response.setHeader('RateLimit-Remaining', String(state.remaining));
    response.setHeader('RateLimit-Reset', String(state.resetSeconds));
    if (!state.allowed) throw await this.rateLimit.tooMany(rule, state);
    return true;
  }
}

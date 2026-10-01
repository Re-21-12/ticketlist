import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../modules/auth/session/public.decorator.js';
import { KV_STORE, type IKeyValueStore } from '../kv/kv-store.interface.js';
import { SkipRateLimit } from '../rate-limit/rate-limit.decorator.js';

/**
 * Sondas para el orquestador (Docker/Dokploy). Públicas y SIN rate limit: un balanceador las
 * llama cada pocos segundos desde una sola IP.
 *  - liveness  `/api/health`        → el proceso responde (si falla, se reinicia el contenedor).
 *  - readiness `/api/health/ready`  → sus dependencias responden (si falla, se le quita tráfico).
 */
@ApiTags('Health')
@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(@Inject(KV_STORE) private readonly kv: IKeyValueStore) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso está vivo' })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: las dependencias responden' })
  async readiness(): Promise<{ status: 'ok'; checks: Record<string, 'up'> }> {
    const kvUp = await this.kv.ping();
    if (!kvUp) throw new ServiceUnavailableException('kv (redis) no responde');
    return { status: 'ok', checks: { [`kv:${this.kv.kind}`]: 'up' } };
  }
}

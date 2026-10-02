import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

/** Métricas del servicio: servicio + transporte (`/api/metrics`). Solo lee tickets, historial y encuestas. */
@Module({
  imports: [TicketsModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsHttpModule {}

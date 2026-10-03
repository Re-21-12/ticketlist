import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module.js';
import { APP_ENV } from '../../config/config.module.js';
import { seedDemoData, type TEnv } from '../../config/env.schema.js';
import { TicketAttachmentsRepository } from './attachments/ticket-attachments.repository.js';
import { TicketEventsRepository } from './events/ticket-events.repository.js';
import { TicketSurveysRepository } from './surveys/ticket-surveys.repository.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketLifecycleService } from './ticket-lifecycle.service.js';
import { TicketsRepository } from './tickets.repository.js';
import { buildTicketsSeed, TICKETS_SEED } from './tickets.seed.js';
import { TicketsService } from './tickets.service.js';

/**
 * Módulo de DOMINIO (repositorios + servicios), sin controladores — mismo corte que wallet-api
 * (`accounts.module.ts` vs `accounts-http.module.ts`): otros módulos (el BFF del tablero, las
 * métricas) importan esto sin arrastrar las rutas REST.
 */
@Module({
  imports: [CatalogsModule],
  providers: [
    // En las pruebas solo los 3 tickets de siempre; en desarrollo, además datos de demostración para las métricas.
    { provide: TICKETS_SEED, inject: [APP_ENV], useFactory: (env: TEnv) => (seedDemoData(env) ? buildTicketsSeed({ demo: env.NODE_ENV !== 'test' }) : { tickets: [], events: [], surveys: [] }) },
    TicketsRepository,
    TicketEventsRepository,
    TicketAttachmentsRepository,
    TicketSurveysRepository,
    TicketHistoryService,
    TicketsService,
    TicketLifecycleService,
  ],
  exports: [
    TicketsService,
    TicketsRepository,
    TicketEventsRepository,
    TicketAttachmentsRepository,
    TicketSurveysRepository,
    TicketHistoryService,
    TicketLifecycleService,
  ],
})
export class TicketsModule {}

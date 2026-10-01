import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { TicketsModule } from './tickets.module.js';

/** Módulo de TRANSPORTE: expone `/api/tickets`. Lo importa `AppModule`. */
@Module({
  imports: [TicketsModule],
  controllers: [TicketsController],
})
export class TicketsHttpModule {}

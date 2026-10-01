import { Module } from '@nestjs/common';
import { TicketsRepository } from './tickets.repository.js';
import { TicketsService } from './tickets.service.js';

/**
 * Módulo de DOMINIO (repositorio + servicio), sin controlador — mismo corte que wallet-api
 * (`accounts.module.ts` vs `accounts-http.module.ts`): otros módulos (p. ej. el BFF del tablero)
 * importan esto para usar `TicketsService` sin arrastrar las rutas REST.
 */
@Module({
  providers: [TicketsRepository, TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

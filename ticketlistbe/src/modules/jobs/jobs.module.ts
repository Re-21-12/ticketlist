import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module.js';
import { JobsRepository } from './jobs.repository.js';
import { JobsService } from './jobs.service.js';

/** Dominio de las tareas programadas (configuración + planificador). Las rutas viven en `JobsHttpModule`. */
@Module({
  imports: [TicketsModule],
  providers: [JobsRepository, JobsService],
  exports: [JobsService],
})
export class JobsModule {}

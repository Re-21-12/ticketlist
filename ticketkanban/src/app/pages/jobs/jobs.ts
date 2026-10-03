import { Component, inject } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Illustration } from '../../shared/ui/illustration/illustration';
import { JobCard } from './job-card/job-card';
import { JobsStore } from './jobs.store';

/**
 * «Tareas programadas» (solo administración): hoy el cierre automático de tickets «Resuelto» sin respuesta. El
 * administrador la activa o desactiva, elige cuándo corre (cron) y tras cuántas horas cierra, y puede ejecutarla a mano.
 * Cada cambio queda en la auditoría; cada cierre, en el historial de su ticket y con la encuesta en el buzón del solicitante.
 */
@Component({
  selector: 'app-jobs',
  imports: [ButtonModule, Illustration, JobCard],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  protected readonly _store = inject(JobsStore);
}

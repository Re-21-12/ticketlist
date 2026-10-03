/** Parámetros de una tarea; hoy solo el cierre automático los usa. */
export interface IJobParams {
  /** Horas en «Resuelto» sin respuesta del solicitante antes de cerrar el ticket. */
  afterHours?: number;
}

/**
 * Una tarea programada y su configuración (editable por un administrador en «Tareas programadas»). La lógica de cada tarea
 * vive en código (`JobsService`): aquí solo se decide SI corre, CUÁNDO (cron) y con qué parámetros, y se anota la última corrida.
 */
export interface IScheduledJob {
  /** Identificador estable de la tarea (el que usa el código para enlazar su lógica). */
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Expresión cron de 5 campos, interpretada en la zona horaria del calendario hábil (UTC−6). */
  cron: string;
  params: IJobParams;
  lastRunAt: Date | null;
  lastRunStatus: 'ok' | 'error' | null;
  lastRunSummary: string | null;
  /** `schedule` (por el reloj) o el correo de quien la ejecutó a mano. */
  lastRunTrigger: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export const AUTO_CLOSE_JOB_KEY = 'ticket-auto-close';

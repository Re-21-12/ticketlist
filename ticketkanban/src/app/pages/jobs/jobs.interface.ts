/** Lo que el administrador puede cambiar de una tarea (cuerpo de `PATCH /api/jobs/:key`). */
export interface IJobUpdate {
  enabled: boolean;
  cron: string;
  params: { afterHours?: number };
}

/** Una opción rápida de frecuencia. `cron: null` = «Personalizado» (el administrador escribe su expresión). */
export interface ICronPreset {
  id: string;
  label: string;
  cron: string | null;
}

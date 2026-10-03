import type { ICronPreset } from './jobs.interface';

/** Frecuencias habituales. La zona horaria del cron es UTC−6 (la del calendario hábil del servicio). */
export const CRON_PRESETS: readonly ICronPreset[] = [
  { id: 'every-10-min', label: 'Cada 10 minutos', cron: '*/10 * * * *' },
  { id: 'every-30-min', label: 'Cada 30 minutos', cron: '*/30 * * * *' },
  { id: 'hourly', label: 'Cada hora', cron: '0 * * * *' },
  { id: 'every-6-hours', label: 'Cada 6 horas', cron: '0 */6 * * *' },
  { id: 'daily-2am', label: 'Todos los días a las 2:00', cron: '0 2 * * *' },
  { id: 'weekdays-8am', label: 'De lunes a viernes a las 8:00', cron: '0 8 * * 1-5' },
  { id: 'custom', label: 'Personalizado…', cron: null },
];

export const CUSTOM_PRESET_ID = 'custom';

/** Estado de la última corrida: texto + ícono (el color solo refuerza). */
export const RUN_STATUS_META = {
  ok: { label: 'Correcta', icon: 'pi-check-circle', severity: 'success' as const },
  error: { label: 'Con error', icon: 'pi-times-circle', severity: 'danger' as const },
};

/** Quién la ejecutó: el reloj o una persona. */
export const SCHEDULE_TRIGGER = 'schedule';

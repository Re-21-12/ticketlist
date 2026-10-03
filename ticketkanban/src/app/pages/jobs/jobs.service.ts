import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { suppressErrorToast } from '../../core/interceptors/suppress-error-toast.token';
import type { IJobUpdate } from './jobs.interface';
import { JobListSchema, JobSchema } from './jobs.schema';
import type { TJob } from './jobs.types';

/** Acceso HTTP de «Tareas programadas» (`/api/jobs`): solo transporte + validación Zod. */
@Service()
export class JobsService {
  private readonly _http = inject(HttpClient);

  readonly list = httpResource(() => '/api/jobs', { parse: (raw) => JobListSchema.parse(raw) });

  /** Guarda la configuración. El error 400 (cron o plazo inválidos) lo muestra la tarjeta junto al campo: sin toast. */
  update(key: string, dto: IJobUpdate): Observable<TJob> {
    return this._http.patch<unknown>(`/api/jobs/${encodeURIComponent(key)}`, dto, { context: suppressErrorToast() }).pipe(map((raw) => JobSchema.parse(raw)));
  }

  /** «Ejecutar ahora». */
  run(key: string): Observable<TJob> {
    return this._http.post<unknown>(`/api/jobs/${encodeURIComponent(key)}/run`, {}).pipe(map((raw) => JobSchema.parse(raw)));
  }

  reload(): void {
    this.list.reload();
  }
}

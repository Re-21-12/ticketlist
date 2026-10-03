import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { readProblem } from '../../core/interfaces/problem-details.interface';
import type { IJobUpdate } from './jobs.interface';
import { JobsService } from './jobs.service';
import type { TJobList } from './jobs.types';

/** Estado de pantalla de «Tareas programadas»: la lista y qué tarea se está guardando o ejecutando. */
@Service()
export class JobsStore {
  private readonly _service = inject(JobsService);

  /** Clave de la tarea que se guarda / ejecuta (bloquea el doble clic de ESA tarjeta). */
  private readonly $_saving = signal<string | null>(null);
  private readonly $_running = signal<string | null>(null);
  readonly $savingKey = this.$_saving.asReadonly();
  readonly $runningKey = this.$_running.asReadonly();

  readonly $listState = computed<TAsyncState<TJobList>>(() => mapResourceState(this._service.list.status(), this._service.list.value(), this._service.list.error()));

  reload(): void {
    this._service.reload();
  }

  /** Guarda y recarga. Devuelve `null` si salió bien, o el motivo (cron o plazo inválidos) para mostrarlo en la tarjeta. */
  async save(key: string, dto: IJobUpdate): Promise<string | null> {
    if (this.$_saving()) return 'Ya se está guardando';
    this.$_saving.set(key);
    try {
      await firstValueFrom(this._service.update(key, dto));
      this._service.reload();
      return null;
    } catch (error) {
      const problem = readProblem(error);
      return problem?.errors?.[0]?.message ?? problem?.title ?? 'No se pudo guardar. Inténtalo de nuevo.';
    } finally {
      this.$_saving.set(null);
    }
  }

  /** «Ejecutar ahora»: corre la tarea y recarga para ver su resumen. Devuelve su resumen, o `null` si falló. */
  async run(key: string): Promise<string | null> {
    if (this.$_running()) return null;
    this.$_running.set(key);
    try {
      const job = await firstValueFrom(this._service.run(key));
      this._service.reload();
      return job.lastRunSummary;
    } catch {
      return null; // `errorInterceptor` ya avisó
    } finally {
      this.$_running.set(null);
    }
  }
}

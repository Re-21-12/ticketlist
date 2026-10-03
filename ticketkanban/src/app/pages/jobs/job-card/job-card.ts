import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Badge } from '../../../shared/ui/badge/badge';
import { parseCron } from '../cron.util';
import { AFTER_HOURS_MAX, AFTER_HOURS_MIN } from '../jobs.schema';
import { CRON_PRESETS, CUSTOM_PRESET_ID, RUN_STATUS_META, SCHEDULE_TRIGGER } from '../jobs.constants';
import { JobsStore } from '../jobs.store';
import type { TJob } from '../jobs.types';

/** Plazo por defecto del cierre automático (el que usa el backend si no se configuró otro). */
const DEFAULT_AFTER_HOURS = 48;

/**
 * Una tarea programada: activarla, elegir cuándo corre (frecuencias habituales o una expresión cron propia), su plazo en
 * horas y «Ejecutar ahora». Muestra la próxima y la última corrida. Los cambios no se aplican hasta «Guardar».
 */
@Component({
  selector: 'app-job-card',
  imports: [Badge, ButtonModule, DatePipe],
  templateUrl: './job-card.html',
  styleUrl: './job-card.css',
})
export class JobCard {
  protected readonly _store = inject(JobsStore);
  readonly $job = input.required<TJob>();

  protected readonly presets = CRON_PRESETS;
  protected readonly hoursMin = AFTER_HOURS_MIN;
  protected readonly hoursMax = AFTER_HOURS_MAX;
  protected readonly runStatus = RUN_STATUS_META;
  protected readonly scheduleTrigger = SCHEDULE_TRIGGER;

  /** Lo editable arranca con lo guardado y vuelve a ello cuando el servidor devuelve la tarea actualizada. */
  protected readonly $enabled = linkedSignal(() => this.$job().enabled);
  protected readonly $cron = linkedSignal(() => this.$job().cron);
  protected readonly $hours = linkedSignal<number>(() => this.$job().params.afterHours ?? DEFAULT_AFTER_HOURS);
  /** «Personalizado» elegido a mano aunque la expresión coincida con una frecuencia habitual. */
  private readonly $_customMode = signal(false);

  protected readonly $presetId = computed(() => {
    if (this.$_customMode()) return CUSTOM_PRESET_ID;
    return CRON_PRESETS.find((preset) => preset.cron === this.$cron())?.id ?? CUSTOM_PRESET_ID;
  });
  protected readonly $isCustom = computed(() => this.$presetId() === CUSTOM_PRESET_ID);
  protected readonly $usesHours = computed(() => this.$job().key === 'ticket-auto-close');

  protected readonly $cronError = computed(() => (parseCron(this.$cron()) !== null ? null : 'La expresión no es válida: usa 5 campos (minuto hora día mes día-de-la-semana), por ejemplo */10 * * * *.'));
  protected readonly $hoursError = computed(() => {
    if (!this.$usesHours()) return null;
    const hours = this.$hours();
    return Number.isInteger(hours) && hours >= AFTER_HOURS_MIN && hours <= AFTER_HOURS_MAX ? null : `Indica un número entero de horas entre ${AFTER_HOURS_MIN} y ${AFTER_HOURS_MAX}.`;
  });

  protected readonly $dirty = computed(() => {
    const job = this.$job();
    return this.$enabled() !== job.enabled || this.$cron().trim() !== job.cron || (this.$usesHours() && this.$hours() !== (job.params.afterHours ?? DEFAULT_AFTER_HOURS));
  });
  protected readonly $saving = computed(() => this._store.$savingKey() === this.$job().key);
  protected readonly $running = computed(() => this._store.$runningKey() === this.$job().key);

  /** Rechazo del servidor al guardar (cron o plazo inválidos) y resultado de «Ejecutar ahora». */
  protected readonly $serverError = signal<string | null>(null);
  protected readonly $runNotice = signal<string | null>(null);

  protected pickPreset(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const preset = CRON_PRESETS.find((candidate) => candidate.id === id);
    this.$serverError.set(null);
    if (!preset || preset.cron === null) {
      this.$_customMode.set(true);
      return;
    }
    this.$_customMode.set(false);
    this.$cron.set(preset.cron);
  }

  protected setCron(event: Event): void {
    this.$cron.set((event.target as HTMLInputElement).value);
    this.$serverError.set(null);
  }

  protected setHours(event: Event): void {
    this.$hours.set(Number((event.target as HTMLInputElement).value));
    this.$serverError.set(null);
  }

  protected toggle(event: Event): void {
    this.$enabled.set((event.target as HTMLInputElement).checked);
  }

  protected async save(): Promise<void> {
    if (this.$cronError() || this.$hoursError()) return;
    this.$runNotice.set(null);
    const failure = await this._store.save(this.$job().key, {
      enabled: this.$enabled(),
      cron: this.$cron().trim(),
      params: this.$usesHours() ? { afterHours: this.$hours() } : {},
    });
    this.$serverError.set(failure);
    if (!failure) this.$_customMode.set(false);
  }

  protected async run(): Promise<void> {
    this.$serverError.set(null);
    this.$runNotice.set(null);
    const summary = await this._store.run(this.$job().key);
    this.$runNotice.set(summary ?? 'No se pudo ejecutar la tarea.');
  }
}

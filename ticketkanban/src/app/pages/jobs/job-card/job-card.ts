import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ToggleSwitchModule } from '@openng/optimus-ui/toggleswitch';
import { Badge } from '../../../shared/ui/badge/badge';
import { parseCron } from '../cron.util';
import { AFTER_HOURS_MAX, AFTER_HOURS_MIN } from '../jobs.schema';
import { CRON_PRESETS, CUSTOM_PRESET_ID, RUN_STATUS_META, SCHEDULE_TRIGGER } from '../jobs.constants';
import type { ICronPreset } from '../jobs.interface';
import { JobsStore } from '../jobs.store';
import type { TJob } from '../jobs.types';

/** Plazo por defecto del cierre automático (el que usa el backend si no se configuró otro). */
const DEFAULT_AFTER_HOURS = 48;

/** Búsqueda sin acentos ni mayúsculas («deBENDE» encuentra «De lunes a viernes»). */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Una tarea programada: activarla, elegir cuándo corre (frecuencias habituales o una expresión cron propia), su plazo en
 * horas y «Ejecutar ahora». Muestra la próxima y la última corrida. Los cambios no se aplican hasta «Guardar».
 *
 * Todos los controles son de optimus-ui (`p-toggleswitch`, `p-autocomplete`, `pInputText`,
 * `p-inputnumber`): nada de `<select>`, `<input type="number">` ni checkbox nativos dibujados a mano,
 * que además quedaban con alturas distintas entre sí y con los botones.
 */
@Component({
  selector: 'app-job-card',
  imports: [AutoCompleteModule, Badge, ButtonModule, DatePipe, FormsModule, InputNumberModule, InputTextModule, ToggleSwitchModule],
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
  /** «Personalizado» no tiene expresión propia: se manda como preajuste para que el autocomplete
   *  muestre la etiqueta en vez de un texto vacío. */
  protected readonly $presetOption = computed(
    () => CRON_PRESETS.find((preset) => preset.id === this.$presetId()) ?? null,
  );
  protected readonly $isCustom = computed(() => this.$presetId() === CUSTOM_PRESET_ID);
  protected readonly $usesHours = computed(() => this.$job().key === 'ticket-auto-close');

  /** Texto escrito en el autocomplete: filtra las frecuencias (mismo criterio que `dynamic-field`).
   *  Se devuelve una copia mutable porque `suggestions` no acepta `readonly`. */
  private readonly $_query = signal('');
  protected readonly $presetSuggestions = computed<ICronPreset[]>(() => {
    const query = normalizeText(this.$_query());
    if (!query) return [...this.presets];
    return this.presets.filter((preset) => normalizeText(preset.label).includes(query));
  });

  protected filterPresets(event: { query: string }): void {
    this.$_query.set(event.query);
  }

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

  /** El autocomplete devuelve el preajuste elegido (o `null` si se vació el campo). */
  protected pickPreset(preset: ICronPreset | null): void {
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

  /**
   * `p-inputnumber` entrega `number | null` (al borrar el campo). El eco de `writeValue` —el propio
   * componente reemitiendo lo que se le acaba de pasar— se ignora con `Object.is`: sin ese guardia,
   * `valor → ngModelChange → valor` con `autoDetectChanges` es un bucle de detección infinita y la
   * pestaña se cuelga. `Object.is` (y no `===`) para que `NaN` —el hueco al borrar— también corte.
   */
  protected setHours(value: number | null): void {
    const next = value ?? Number.NaN;
    if (Object.is(next, this.$hours())) return;
    this.$hours.set(next);
    this.$serverError.set(null);
  }

  protected setEnabled(enabled: boolean): void {
    this.$enabled.set(enabled);
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

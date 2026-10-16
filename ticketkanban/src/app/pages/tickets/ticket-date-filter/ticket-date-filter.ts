import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { PopoverModule, type Popover } from '@openng/optimus-ui/popover';
import { formatDayShort, fromIsoDay, toIsoDay } from '../../../shared/date/local-date.util';
import { TICKET_DATE_PRESETS } from '../ticket.constants';
import { dateRangeError } from '../ticket-filter.util';
import { TicketsStore } from '../tickets.store';

/** Rango del filtro de fechas, tal y como lo guarda `TicketsStore.$filters()`. */
type TRange = { createdFrom: string; createdTo: string };

/** Lo queBindea el `p-datepicker` con `selectionMode="range"`: un rango, un día suelto o nada. */
type TPickerValue = Date | Date[] | null;

/**
 * Filtro por FECHA DE REGISTRO de `/tickets`: el atajo «Hoy» y un rango arbitrario.
 *
 * Va en un desplegable (`p-popover`) y no como dos campos sueltos en la barra de filtros: la barra
 * ya lleva búsqueda + cinco selects + dos casillas, y dos campos más la convertían en un muro de
 * controles. Dentro van los atajos (día, 7, 30, 90 y el mes en curso) y el calendario de rango.
 *
 * Las fechas van en días LOCALES (`YYYY-MM-DD`, ver `shared/date/local-date.util.ts`) y el backend
 * las interpreta en UTC con el extremo final inclusivo, así que «Hoy» incluye el día entero sin
 * desfase por zona horaria.
 */
@Component({
  selector: 'app-ticket-date-filter',
  imports: [FormsModule, ButtonModule, DatePickerModule, PopoverModule],
  templateUrl: './ticket-date-filter.html',
  styleUrl: './ticket-date-filter.css',
})
export class TicketDateFilter {
  protected readonly _ticketsStore = inject(TicketsStore);
  protected readonly presets = TICKET_DATE_PRESETS;

  /** Rango ya aplicado (lo que el store sabe). */
  protected readonly $applied = computed<TRange>(() => {
    const filters = this._ticketsStore.$filters();
    return { createdFrom: filters.createdFrom, createdTo: filters.createdTo };
  });

  /** Lo que hay elegido en el calendario, todavía sin aplicar; `null` = el aplicado. */
  private readonly $_chosen = signal<TRange | null>(null);
  protected readonly $error = signal<string | null>(null);

  /** El calendario no deja elegir fuera del otro extremo ya aplicado. */
  protected readonly $maxDate = computed(() => fromIsoDay(this.$applied().createdTo));
  protected readonly $minDate = computed(() => fromIsoDay(this.$applied().createdFrom));

  /** Valor del calendario: lo elegido si hay algo, si no el rango aplicado (para abrir donde está). */
  protected readonly $picker = computed<TPickerValue>(() => {
    const chosen = this.$_chosen();
    const { createdFrom, createdTo } = chosen ?? this.$applied();
    const from = fromIsoDay(createdFrom);
    const to = fromIsoDay(createdTo);
    if (from && to) return [from, to];
    return from ?? to ?? null;
  });

  /** Cuántos días abarca el rango aplicado, para saber si un atajo está activo. */
  protected readonly $appliedKey = computed(() => {
    const { createdFrom, createdTo } = this.$applied();
    if (!createdFrom && !createdTo) return '';
    const today = new Date();
    return TICKET_DATE_PRESETS.find((preset) => {
      const { from, to } = preset.range(today);
      return toIsoDay(from) === createdFrom && toIsoDay(to) === createdTo;
    })?.id ?? '';
  });

  /** Texto del botón: dice qué está filtrando, no solo «Fechas». */
  protected readonly $label = computed(() => {
    const { createdFrom, createdTo } = this.$applied();
    if (!createdFrom && !createdTo) return 'Fechas';
    if (createdFrom === createdTo) {
      return createdFrom === toIsoDay(new Date()) ? 'Hoy' : formatDayShort(createdFrom);
    }
    if (createdFrom && createdTo) return `${formatDayShort(createdFrom)} – ${formatDayShort(createdTo)}`;
    return createdFrom ? `Desde ${formatDayShort(createdFrom)}` : `Hasta ${formatDayShort(createdTo)}`;
  });

  protected readonly $active = computed(() => !!(this.$applied().createdFrom || this.$applied().createdTo));

  protected pickPreset(id: string, panel: Popover): void {
    const preset = this.presets.find((item) => item.id === id);
    if (!preset) return;
    const { from, to } = preset.range(new Date());
    this.apply({ createdFrom: toIsoDay(from), createdTo: toIsoDay(to) });
    panel.hide();
  }

  /** Eligió un rango en el calendario: se aplica directo (nada que confirmar y olvidar). */
  protected pickRange(value: TPickerValue): void {
    if (!value) {
      this.apply({ createdFrom: '', createdTo: '' });
      return;
    }
    const [first, second] = Array.isArray(value) ? value : [value, null];
    const range: TRange = { createdFrom: toIsoDay(first), createdTo: toIsoDay(second ?? first) };
    const error = dateRangeError(range.createdFrom, range.createdTo);
    if (error) {
      // No se aplica: se avisa debajo y el listado sigue mostrando lo que había.
      this.$error.set(error);
      return;
    }
    this.apply(range);
  }

  protected clear(panel: Popover): void {
    this.apply({ createdFrom: '', createdTo: '' });
    panel.hide();
  }

  private apply(range: TRange): void {
    this.$error.set(null);
    this.$_chosen.set(range);
    this._ticketsStore.setFilters(range);
  }
}
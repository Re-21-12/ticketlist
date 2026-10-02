import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { computed, inject, Injector, runInInjectionContext, Service, type Signal } from '@angular/core';
import * as z from 'zod';
import type { IFieldOption } from '../dynamic-form/field-config.interface';
import { BADGE_SEVERITIES } from '../ui/badge/badge.types';

const OptionsSchema = z.object({
  data: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      icon: z.string().nullable().optional(),
      severity: z.enum(BADGE_SEVERITIES).nullable().optional(),
    }),
  ),
});

/**
 * Opciones de un catálogo (`GET /api/catalogs/:key/options`, solo elementos ACTIVOS y ordenados, con su
 * ícono y color). Una petición por catálogo, compartida por toda la app. Mientras carga, o si falla,
 * devuelve el respaldo que se le pasó (las etiquetas del contrato): un formulario nunca se queda sin opciones.
 *
 * Los catálogos de sistema solo cambian etiqueta, orden, ícono y color, así que el respaldo y la respuesta
 * coinciden en los CÓDIGOS (los que valida el schema Zod); una opción desconocida se ignora.
 */
@Service()
export class CatalogOptionsService {
  private readonly _injector = inject(Injector);
  private readonly _resources = new Map<string, HttpResourceRef<z.output<typeof OptionsSchema> | undefined>>();

  /**
   * `open: true` → catálogo EDITABLE de verdad (departamentos): se ofrecen también los elementos nuevos que la
   * organización agregue. Sin él (catálogos de sistema), un código que el schema no conoce se ignora.
   */
  options(key: string, fallback: readonly IFieldOption[], open = false): Signal<IFieldOption[]> {
    const resource = this.resourceFor(key);
    return computed(() => {
      const value = resource.hasValue() ? resource.value() : undefined;
      const known = new Map(fallback.map((option) => [option.value, option]));
      const fromCatalog =
        value?.data
          .filter((option) => open || known.has(option.value))
          // Si el catálogo no define ícono o color, queda el del respaldo (nunca una insignia «desnuda»).
          .map<IFieldOption>((option) => ({
            value: option.value,
            label: option.label,
            icon: option.icon ?? known.get(option.value)?.icon ?? null,
            severity: option.severity ?? known.get(option.value)?.severity ?? null,
          })) ?? [];
      return fromCatalog.length ? fromCatalog : [...fallback];
    });
  }

  /** Vuelve a pedir todos los catálogos ya abiertos (tras editar uno en «Catálogos»). */
  reloadAll(): void {
    for (const resource of this._resources.values()) resource.reload();
  }

  private resourceFor(key: string): HttpResourceRef<z.output<typeof OptionsSchema> | undefined> {
    let resource = this._resources.get(key);
    if (!resource) {
      resource = runInInjectionContext(this._injector, () =>
        httpResource(() => `/api/catalogs/${key}/options`, { parse: (raw) => OptionsSchema.parse(raw) }),
      );
      this._resources.set(key, resource);
    }
    return resource;
  }
}

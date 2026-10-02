import { Service, signal } from '@angular/core';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { RelationshipAdminSchema } from './relationship-admin.schema';
import type { TRelationshipAdmin } from './relationship-admin.types';

/**
 * Acceso HTTP de `/api/relationships/admin` (solo ADMIN): lista de TODAS las relaciones y revocar
 * cualquiera. `softDelete` (DELETE `/:uuid`) aquí significa REVOCAR: el historial se conserva.
 */
@Service()
export class RelationPermissionsService extends BaseApiAbstract<TRelationshipAdmin, never, never, { status: string }> {
  protected readonly endpoint = '/api/relationships/admin';
  protected readonly $uuid = signal<string | undefined>(undefined);

  protected override parseItem(raw: unknown): TRelationshipAdmin {
    return RelationshipAdminSchema.parse(raw);
  }

  /** Filtro de estado; vacío = todas (el backend rechaza `?status=`). */
  filterStatus(status: string): void {
    this.setFilters(status ? { status } : undefined);
  }
}

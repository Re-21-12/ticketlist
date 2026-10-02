import { HttpClient, httpResource } from '@angular/common/http';
import { computed, inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { mapResourceState } from '../../core/interfaces/async-state.types';
import { RelationshipListSchema, RelationshipSchema } from './relationship.schema';
import type { TGrantsForm, TRelationship, TShareForm } from './relationship.types';

const BASE = '/api/relationships';

/** Lo que viaja al backend: un grant por recurso; leer siempre va incluido. */
function toGrants(form: Pick<TGrantsForm, 'canUpdate' | 'notifyTitular'>) {
  return [{ objectType: 'Ticket', canRead: true, ...form }];
}

/**
 * Acceso HTTP de `/api/relationships`. La lista trae las relaciones donde soy titular y donde soy
 * alternante (`myRole`). Revocar no borra: queda `REVOKED` con su historial.
 */
@Service()
export class SharingService {
  private readonly _http = inject(HttpClient);

  readonly list = httpResource(() => BASE, { parse: (raw) => RelationshipListSchema.parse(raw) });
  readonly $listState = computed(() => mapResourceState(this.list.status(), this.list.value(), this.list.error()));

  reload(): void {
    this.list.reload();
  }

  share(form: TShareForm): Observable<TRelationship> {
    const { alternanteEmail, consent, ...grants } = form;
    return this._http
      .post<unknown>(BASE, { alternanteEmail, grants: toGrants(grants), consent })
      .pipe(map((raw) => RelationshipSchema.parse(raw)));
  }

  updateGrants(uuid: string, form: TGrantsForm): Observable<TRelationship> {
    const { consent, ...grants } = form;
    return this._http
      .patch<unknown>(`${BASE}/${uuid}/grants`, { grants: toGrants(grants), consent })
      .pipe(map((raw) => RelationshipSchema.parse(raw)));
  }

  revoke(uuid: string): Observable<void> {
    return this._http.delete<void>(`${BASE}/${uuid}`);
  }
}

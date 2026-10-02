import { HttpClient, httpResource } from '@angular/common/http';
import { computed, inject, Service } from '@angular/core';
import { forkJoin, map, of, type Observable } from 'rxjs';
import * as z from 'zod';
import { mapResourceState } from '../../core/interfaces/async-state.types';
import type { EAbility, EUserRole } from '../../core/casl/ability.enum';
import type { TSubjects } from '../../core/casl/casl.types';
import { RolePermissionSchema } from '../role-permissions/role-permission.schema';
import type { TRolePermission } from '../role-permissions/role-permission.types';
import { UserSchema } from '../users/user.schema';

const RULES_URL = '/api/role-permissions';
/** El backend topa `take` en 100; la matriz avisa si hay más reglas de las que cargó. */
const PAGE_SIZE = 100;

const meta = z.object({ total: z.number().int(), page: z.number().int(), take: z.number().int() });
const RulesPageSchema = z.object({ data: z.array(RolePermissionSchema), meta });
const UsersPageSchema = z.object({ data: z.array(UserSchema), meta });

/**
 * Datos de la matriz de roles: todas las reglas (`/api/role-permissions`) y las personas
 * (`/api/users`, para contar miembros por rol). Conceder = crear la regla sin condición; quitar =
 * eliminar las reglas de esa celda. Condiciones y excepciones se afinan en «Permisos por rol».
 */
@Service()
export class RoleMatrixService {
  private readonly _http = inject(HttpClient);

  readonly rules = httpResource(() => ({ url: RULES_URL, params: { take: PAGE_SIZE } }), {
    parse: (raw) => RulesPageSchema.parse(raw),
  });
  readonly users = httpResource(() => ({ url: '/api/users', params: { take: PAGE_SIZE } }), {
    parse: (raw) => UsersPageSchema.parse(raw),
  });

  readonly $rulesState = computed(() => mapResourceState(this.rules.status(), this.rules.value(), this.rules.error()));
  readonly $usersState = computed(() => mapResourceState(this.users.status(), this.users.value(), this.users.error()));

  reload(): void {
    this.rules.reload();
    this.users.reload();
  }

  grant(role: EUserRole, subject: TSubjects, action: EAbility): Observable<TRolePermission> {
    return this._http
      .post<unknown>(RULES_URL, { role, subject, action, condition: 'NONE' })
      .pipe(map((raw) => RolePermissionSchema.parse(raw)));
  }

  revoke(rules: readonly TRolePermission[]): Observable<unknown> {
    return rules.length ? forkJoin(rules.map((rule) => this._http.delete<void>(`${RULES_URL}/${rule.uuid}`))) : of(null);
  }
}

import { Injectable } from '@nestjs/common';
import { createMongoAbility } from '@casl/ability';
import { RolePermissionsRepository } from '../../access-control/role-permissions/role-permissions.repository.js';
import { RelationshipsRepository } from '../../relationships/relationships.repository.js';
import type { ISessionUser } from '../session/session-user.interface.js';
import { EAbility, EUserRole } from './ability.enum.js';
import type { TAppAbility, TAppRule, TConditionPreset } from './casl.types.js';

/**
 * Techo por ROL del alternante (mismo concepto que `ALTERNANTE_ROLE_CEILING` de wallet-api): lo
 * que el titular conceda nunca supera esto. Un VIEWER nunca escribe, aunque se le conceda.
 */
const ALTERNANTE_ROLE_CEILING: Record<EUserRole, 'read' | 'managed'> = {
  [EUserRole.ADMIN]: 'managed',
  [EUserRole.AGENT]: 'managed',
  [EUserRole.VIEWER]: 'read',
};

/**
 * ÚNICA fuente de reglas CASL (el front las recibe por `GET /api/bff/shell` y no las recalcula).
 * Combina, en este orden (docs/standard/authorization.md):
 *
 *  1. RBAC + ABAC — `role_permissions` del rol (DB-first, editable por ADMIN vía
 *     `/api/role-permissions`), con condición por preset (`OWN`, `ASSIGNED_TO_ME`).
 *  2. Titular — sobre SUS filas (`ownerUuid = yo`) siempre puede leer/editar/eliminar/restaurar,
 *     y gestiona sus relaciones (`titularUuid = yo`). Precedencia máxima (wallet-api §3).
 *  3. ReBAC — concesiones ACTIVAS de titulares hacia mí, proyectadas como condición
 *     `ownerUuid ∈ titulares` por operación, recortadas por el techo del rol. Proyectarlas en el
 *     Ability (en wallet-api se resuelven en el service + RLS) permite que el front muestre
 *     «Editar» exactamente cuando el backend lo permitirá.
 *  4. Autoservicio — mis notificaciones (`recipientUuid = yo`) y las relaciones donde soy alternante.
 */
@Injectable()
export class CaslAbilityFactory {
  constructor(
    private readonly rolePermissionsRepository: RolePermissionsRepository,
    private readonly relationshipsRepository: RelationshipsRepository,
  ) {}

  rulesFor(user: ISessionUser): TAppRule[] {
    return [
      ...this.roleRules(user),
      ...this.titularRules(user),
      ...this.rebacRules(user),
      ...this.selfServiceRules(user),
    ];
  }

  createForUser(user: ISessionUser | null): TAppAbility {
    return createMongoAbility<TAppAbility>(user ? this.rulesFor(user) : []);
  }

  private roleRules(user: ISessionUser): TAppRule[] {
    return this.rolePermissionsRepository.findActiveByRole(user.role).map((permission) => {
      const conditions = this.conditionFor(permission.condition, user);
      return {
        action: permission.action,
        subject: permission.subject,
        ...(conditions ? { conditions } : {}),
      };
    });
  }

  private titularRules(user: ISessionUser): TAppRule[] {
    const own = { ownerUuid: user.uuid };
    return [
      { action: EAbility.READ, subject: 'Ticket', conditions: own },
      { action: EAbility.UPDATE, subject: 'Ticket', conditions: own },
      { action: EAbility.DELETE, subject: 'Ticket', conditions: own },
      { action: EAbility.RESTORE, subject: 'Ticket', conditions: own },
      { action: EAbility.CREATE, subject: 'Relationship' },
      { action: EAbility.READ, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
      { action: EAbility.UPDATE, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
      { action: EAbility.DELETE, subject: 'Relationship', conditions: { titularUuid: user.uuid } },
    ];
  }

  private rebacRules(user: ISessionUser): TAppRule[] {
    const canWrite = ALTERNANTE_ROLE_CEILING[user.role] === 'managed';
    const titularesBy = { read: [] as string[], update: [] as string[], delete: [] as string[] };
    for (const relationship of this.relationshipsRepository.findActiveAsAlternante(user.uuid)) {
      const grant = relationship.grants.find((g) => g.objectType === 'Ticket');
      if (!grant) continue;
      if (grant.canRead) titularesBy.read.push(relationship.titularUuid);
      if (canWrite && grant.canUpdate) titularesBy.update.push(relationship.titularUuid);
      if (canWrite && grant.canDelete) titularesBy.delete.push(relationship.titularUuid);
    }
    const rule = (action: EAbility, titulares: string[]): TAppRule[] =>
      titulares.length ? [{ action, subject: 'Ticket', conditions: { ownerUuid: { $in: titulares } } }] : [];
    return [
      ...rule(EAbility.READ, titularesBy.read),
      ...rule(EAbility.UPDATE, titularesBy.update),
      ...rule(EAbility.DELETE, titularesBy.delete),
    ];
  }

  private selfServiceRules(user: ISessionUser): TAppRule[] {
    const mine = { recipientUuid: user.uuid };
    return [
      { action: EAbility.READ, subject: 'Notification', conditions: mine },
      { action: EAbility.UPDATE, subject: 'Notification', conditions: mine },
      { action: EAbility.READ, subject: 'Relationship', conditions: { alternanteUuid: user.uuid } },
    ];
  }

  private conditionFor(preset: TConditionPreset, user: ISessionUser): Record<string, unknown> | null {
    switch (preset) {
      case 'OWN':
        return { ownerUuid: user.uuid };
      case 'ASSIGNED_TO_ME':
        return { assigneeEmail: user.email };
      default:
        return null;
    }
  }
}

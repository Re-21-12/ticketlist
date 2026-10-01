import { BaseEntity } from '../../core/base.entity.js';
import type { RELATIONSHIP_STATUS, SHAREABLE_OBJECT_TYPES } from './schemas/relationship.schema.js';

/** Concesión (en wallet-api: `relationship_grants`). Se conserva al revocar la relación. */
export interface IRelationshipGrant {
  objectType: (typeof SHAREABLE_OBJECT_TYPES)[number];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  notifyTitular: boolean;
  consentVersion: string;
  consentedAt: Date;
  consentedBy: string;
}

/** Vínculo Titular → Alternante (en wallet-api: `relationships`). */
export class RelationshipEntity extends BaseEntity {
  titularUuid!: string;
  alternanteUuid!: string;
  status!: (typeof RELATIONSHIP_STATUS)[number];
  grants!: IRelationshipGrant[];
  /** Fin de la relación (REVOKED): el historial se conserva, el acceso se pierde al instante. */
  endedAt!: Date | null;
}

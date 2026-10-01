import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/base.repository.js';
import type { RelationshipEntity } from './relationship.entity.js';

@Injectable()
export class RelationshipsRepository extends InMemoryRepository<RelationshipEntity> {
  protected readonly searchableFields: (keyof RelationshipEntity)[] = ['status'];

  constructor() {
    super([]);
  }

  /** Relaciones ACTIVAS donde `userUuid` es alternante — fuente de ReBAC en CaslAbilityFactory. */
  findActiveAsAlternante(userUuid: string): RelationshipEntity[] {
    return this.rows.filter((r) => r.alternanteUuid === userUuid && r.status === 'ACTIVE' && !r.isDeleted);
  }

  findActiveBetween(titularUuid: string, alternanteUuid: string): RelationshipEntity | null {
    return (
      this.rows.find(
        (r) => r.titularUuid === titularUuid && r.alternanteUuid === alternanteUuid && r.status === 'ACTIVE',
      ) ?? null
    );
  }

  /** Todas las del usuario (como titular o alternante), incluidas las revocadas (historial). */
  findAllFor(userUuid: string): RelationshipEntity[] {
    return this.rows
      .filter((r) => !r.isDeleted && (r.titularUuid === userUuid || r.alternanteUuid === userUuid))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

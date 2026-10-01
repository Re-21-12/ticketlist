import { Global, Module } from '@nestjs/common';
import { RelationshipsRepository } from './relationships.repository.js';
import { RelationshipsService } from './relationships.service.js';

/** Dominio. Global porque `CaslAbilityFactory` (ReBAC) y los tickets leen las relaciones. */
@Global()
@Module({
  providers: [RelationshipsRepository, RelationshipsService],
  exports: [RelationshipsRepository, RelationshipsService],
})
export class RelationshipsModule {}

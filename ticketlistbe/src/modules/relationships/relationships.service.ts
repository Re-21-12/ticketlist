import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { RelationshipEntity, type IRelationshipGrant } from './relationship.entity.js';
import { RelationshipsRepository } from './relationships.repository.js';
import {
  CURRENT_CONSENT_VERSION,
  RelationshipResponseSchema,
  type GrantSchema,
  type RelationshipCreateSchema,
  type RelationshipGrantsUpdateSchema,
} from './schemas/relationship.schema.js';

type TRelationshipResponse = z.output<typeof RelationshipResponseSchema>;

/**
 * Relaciones Titular → Alternante (docs/standard/authorization.md, modelo de wallet-api
 * `docs/security/modelo-titular-alternante.md`):
 *  - Solo el TITULAR crea, amplía, reduce o revoca: es el único que fija las reglas.
 *  - Cada concesión guarda quién, cuándo y con qué versión del consentimiento se otorgó.
 *  - Revocar NO borra: `status=REVOKED` + `endedAt`, las concesiones quedan como historial y el
 *    alternante pierde el acceso al instante (CaslAbilityFactory solo proyecta relaciones ACTIVE).
 */
@Injectable()
export class RelationshipsService {
  constructor(
    private readonly repository: RelationshipsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  listMine(): TRelationshipResponse[] {
    const me = this.me();
    return this.repository.findAllFor(me.uuid).map((r) => this.toResponse(r, me.uuid));
  }

  async create(dto: z.output<typeof RelationshipCreateSchema>): Promise<TRelationshipResponse> {
    const me = this.me();
    const alternante = this.usersRepository.findByEmail(dto.alternanteEmail);
    if (!alternante) {
      throw new CustomBusinessException(ERROR_CODES.REL.ALTERNANTE_NOT_FOUND, { field: 'alternanteEmail' });
    }
    if (alternante.uuid === me.uuid) throw new CustomBusinessException(ERROR_CODES.REL.SELF_RELATIONSHIP);
    if (this.repository.findActiveBetween(me.uuid, alternante.uuid)) {
      throw new CustomBusinessException(ERROR_CODES.REL.ALREADY_ACTIVE, { value: dto.alternanteEmail });
    }

    const saved = await this.repository.create(
      Object.assign(new RelationshipEntity(), {
        uuid: randomUUID(),
        titularUuid: me.uuid,
        alternanteUuid: alternante.uuid,
        status: 'ACTIVE' as const,
        grants: this.toGrants(dto.grants, me.uuid),
        endedAt: null,
        createdAt: new Date(),
        createdBy: me.uuid,
        updatedAt: null,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
        isDeleted: false,
        restoredAt: null,
        restoredBy: null,
      }),
    );
    this.notificationsService.notify({
      recipientUuid: alternante.uuid,
      type: 'RELATIONSHIP_GRANTED',
      message: `${me.name} compartió sus tickets contigo`,
      resourceType: 'Relationship',
      resourceUuid: saved.uuid,
    });
    return this.toResponse(saved, me.uuid);
  }

  async updateGrants(
    uuid: string,
    dto: z.output<typeof RelationshipGrantsUpdateSchema>,
  ): Promise<TRelationshipResponse> {
    const me = this.me();
    const current = await this.findTitularActive(uuid, me.uuid);
    const updated = Object.assign(new RelationshipEntity(), current, {
      grants: this.toGrants(dto.grants, me.uuid),
      updatedAt: new Date(),
      updatedBy: me.uuid,
    });
    await this.repository.update(updated);
    this.notificationsService.notify({
      recipientUuid: current.alternanteUuid,
      type: 'RELATIONSHIP_GRANTED',
      message: `${me.name} cambió lo que comparte contigo`,
      resourceType: 'Relationship',
      resourceUuid: uuid,
    });
    return this.toResponse(updated, me.uuid);
  }

  async revoke(uuid: string): Promise<void> {
    const me = this.me();
    const current = await this.findTitularActive(uuid, me.uuid);
    await this.repository.update(
      Object.assign(new RelationshipEntity(), current, {
        status: 'REVOKED' as const,
        endedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: me.uuid,
      }),
    );
    this.notificationsService.notify({
      recipientUuid: current.alternanteUuid,
      type: 'RELATIONSHIP_REVOKED',
      message: `${me.name} dejó de compartir sus tickets contigo`,
      resourceType: 'Relationship',
      resourceUuid: uuid,
    });
  }

  /** Visible para el usuario (titular o alternante), activa y donde ÉL es el titular. */
  private async findTitularActive(uuid: string, meUuid: string): Promise<RelationshipEntity> {
    const relationship = await this.repository.findByUuid(uuid);
    const visible =
      relationship && (relationship.titularUuid === meUuid || relationship.alternanteUuid === meUuid);
    if (!visible || relationship.status !== 'ACTIVE') {
      throw new CustomBusinessException(ERROR_CODES.REL.NOT_FOUND, { uuid });
    }
    if (relationship.titularUuid !== meUuid) throw new CustomBusinessException(ERROR_CODES.REL.NOT_TITULAR, { uuid });
    return relationship;
  }

  private toGrants(grants: z.output<typeof GrantSchema>[], consentedBy: string): IRelationshipGrant[] {
    const consentedAt = new Date();
    return grants.map((grant) => ({ ...grant, consentVersion: CURRENT_CONSENT_VERSION, consentedAt, consentedBy }));
  }

  private me() {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return user;
  }

  private toResponse(r: RelationshipEntity, meUuid: string): TRelationshipResponse {
    return RelationshipResponseSchema.parse({
      uuid: r.uuid,
      titularUuid: r.titularUuid,
      alternanteUuid: r.alternanteUuid,
      alternanteEmail: this.usersRepository.findByUuid(r.alternanteUuid)?.email,
      status: r.status,
      grants: r.grants.map(({ consentedBy: _by, consentedAt, ...grant }) => ({
        ...grant,
        consentedAt: consentedAt.toISOString(),
      })),
      endedAt: r.endedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      myRole: r.titularUuid === meUuid ? 'TITULAR' : 'ALTERNANTE',
    });
  }
}

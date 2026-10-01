import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { BaseService } from '../../core/base.service.js';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RelationshipsRepository } from '../relationships/relationships.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import type { TSubjects } from '../auth/casl/casl.types.js';
import type { TTicketResponse } from './dtos/ticket-response.dto.js';
import {
  TicketResponseSchema,
  type TicketCreateSchema,
  type TicketUpsertSchema,
} from './schemas/ticket.schema.js';
import { TicketEntity } from './ticket.entity.js';
import { TicketsRepository } from './tickets.repository.js';

type TCreate = z.output<typeof TicketCreateSchema>;
type TUpdate = z.output<typeof TicketUpsertSchema>;

/** `Date` local → 'YYYY-MM-DD' (columna `date`, sin corrimiento por zona horaria). */
function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Capa de NEGOCIO de tickets. Hereda el CRUD de `BaseService`; aquí solo el mapeo del recurso y
 * la numeración. `toResponse` parsea con `TicketResponseSchema`: si alguien agrega un campo a la
 * entidad sin actualizar el contrato, falla aquí y no en el cliente.
 */
@Injectable()
export class TicketsService extends BaseService<TicketEntity, TTicketResponse, TCreate, TUpdate> {
  protected readonly codes = ERROR_CODES.TCK;
  protected readonly caslSubject: TSubjects = 'Ticket';

  constructor(
    protected override readonly repository: TicketsRepository,
    abilityFactory: CaslAbilityFactory,
    private readonly usersRepository: UsersRepository,
    private readonly relationshipsRepository: RelationshipsRepository,
    private readonly notificationsService: NotificationsService,
  ) {
    super(repository, abilityFactory);
  }

  /** Aviso a quien quedó asignado (al crear con responsable o al cambiarlo). */
  protected override onCreated(created: TicketEntity): void {
    this.notifyAssignee(created);
  }

  /**
   * - Cambió el responsable → aviso al nuevo.
   * - Quien editó es ALTERNANTE del titular y la concesión tiene `notifyTitular` → aviso al titular
   *   (misma tabla de relaciones que autoriza, sin lógica paralela).
   */
  protected override onUpdated(before: TicketEntity, after: TicketEntity): void {
    if (before.assigneeEmail !== after.assigneeEmail) this.notifyAssignee(after);

    const actor = this.getActor();
    if (actor === after.ownerUuid) return;
    const relationship = this.relationshipsRepository.findActiveBetween(after.ownerUuid, actor);
    const grant = relationship?.grants.find((g) => g.objectType === 'Ticket');
    if (grant?.notifyTitular) {
      const actorName = this.usersRepository.findByUuid(actor)?.name ?? 'Un alternante';
      this.notificationsService.notify({
        recipientUuid: after.ownerUuid,
        type: 'TICKET_CHANGED_BY_ALTERNANTE',
        message: `${actorName} modificó ${after.code} «${after.title}»`,
        resourceType: 'Ticket',
        resourceUuid: after.uuid,
      });
    }
  }

  private notifyAssignee(ticket: TicketEntity): void {
    if (!ticket.assigneeEmail) return;
    const assignee = this.usersRepository.findByEmail(ticket.assigneeEmail);
    if (!assignee) return;
    this.notificationsService.notify({
      recipientUuid: assignee.uuid,
      type: 'TICKET_ASSIGNED',
      message: `Te asignaron ${ticket.code} «${ticket.title}»`,
      resourceType: 'Ticket',
      resourceUuid: ticket.uuid,
    });
  }

  protected toEntity(dto: TCreate, createdBy: string): TicketEntity {
    return Object.assign(new TicketEntity(), {
      ...dto,
      otherCategoryDetail: dto.category === 'other' ? (dto.otherCategoryDetail ?? null) : null,
      dueDate: toIsoDate(dto.dueDate),
      uuid: randomUUID(),
      ownerUuid: createdBy,
      code: this.repository.nextCode(),
      createdAt: new Date(),
      createdBy,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      isDeleted: false,
      restoredAt: null,
      restoredBy: null,
    });
  }

  protected mergeEntity(entity: TicketEntity, dto: TUpdate, updatedBy: string): TicketEntity {
    return Object.assign(new TicketEntity(), entity, {
      ...dto,
      otherCategoryDetail: dto.category === 'other' ? (dto.otherCategoryDetail ?? null) : null,
      dueDate: toIsoDate(dto.dueDate),
      updatedAt: new Date(),
      updatedBy,
    });
  }

  protected toResponse(entity: TicketEntity): TTicketResponse {
    return TicketResponseSchema.parse({
      uuid: entity.uuid,
      ownerUuid: entity.ownerUuid,
      code: entity.code,
      title: entity.title,
      description: entity.description,
      category: entity.category,
      ...(entity.otherCategoryDetail ? { otherCategoryDetail: entity.otherCategoryDetail } : {}),
      priority: entity.priority,
      status: entity.status,
      assigneeEmail: entity.assigneeEmail,
      estimateHours: entity.estimateHours,
      dueDate: entity.dueDate,
      notifyReporter: entity.notifyReporter,
      createdAt: entity.createdAt.toISOString(),
    });
  }
}

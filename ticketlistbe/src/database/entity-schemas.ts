import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import type { ICatalog, ICatalogItem } from '../modules/catalogs/catalogs.repository.js';
import type { MenuItemEntity } from '../modules/menu-items/menu-item.entity.js';
import type { NotificationEntity } from '../modules/notifications/notification.entity.js';
import type { RolePermissionEntity } from '../modules/access-control/role-permissions/role-permission.entity.js';
import type { RelationshipEntity } from '../modules/relationships/relationship.entity.js';
import type { ITicketAttachment } from '../modules/tickets/attachments/ticket-attachment.entity.js';
import type { ITicketEvent } from '../modules/tickets/events/ticket-event.entity.js';
import type { ITicketSurvey } from '../modules/tickets/surveys/ticket-survey.entity.js';
import type { TicketEntity } from '../modules/tickets/ticket.entity.js';
import type { IStoredUser } from '../modules/users/users.repository.js';

/**
 * Esquemas de TABLA (TypeORM `EntitySchema`): describen cómo se guarda cada entidad SIN tocar las clases de
 * dominio. Columnas en `snake_case` (ver `SnakeNamingStrategy`). El esquema real lo crean las MIGRACIONES
 * (`src/database/migrations`), nunca `synchronize`.
 *
 * Las claves foráneas NO se declaran: la integridad la mantiene la capa de servicio (igual que antes) y las
 * semillas se insertan en el orden que decide el arranque. Los índices sí (búsquedas por dueño, estado, etc.).
 */

/** Opciones mínimas de una tabla. Se tipan a mano (no con `EntitySchemaOptions<T>`): sus tipos genéricos hacen que el compilador agote la memoria con entidades grandes. */
interface ITableOptions {
  name: string;
  tableName: string;
  columns: Record<string, EntitySchemaColumnOptions>;
  indices?: { name: string; columns: string[]; unique?: boolean }[];
}

/** Define una tabla para la entidad `T` (el tipo solo sirve a quien la consume: `PersistenceService`, repositorios). */
function defineTable<T extends object>(options: ITableOptions): EntitySchema<T> {
  return new EntitySchema(options as never) as unknown as EntitySchema<T>;
}

const nullable = (options: EntitySchemaColumnOptions): EntitySchemaColumnOptions => ({ ...options, nullable: true });

/** Auditoría + borrado lógico + restauración (`BaseEntity`). La clave primaria es `uuid`; `id` es un contador propio. */
const BASE_COLUMNS = {
  id: { type: 'int' } as EntitySchemaColumnOptions,
  uuid: { type: 'uuid', primary: true } as EntitySchemaColumnOptions,
  createdAt: { type: 'timestamptz' } as EntitySchemaColumnOptions,
  createdBy: nullable({ type: 'varchar', length: 64 }),
  updatedAt: nullable({ type: 'timestamptz' }),
  updatedBy: nullable({ type: 'varchar', length: 64 }),
  deletedAt: nullable({ type: 'timestamptz' }),
  deletedBy: nullable({ type: 'varchar', length: 64 }),
  isDeleted: { type: 'boolean', default: false } as EntitySchemaColumnOptions,
  restoredAt: nullable({ type: 'timestamptz' }),
  restoredBy: nullable({ type: 'varchar', length: 64 }),
};

export const UserSchema = defineTable<IStoredUser>({
  name: 'users',
  tableName: 'users',
  columns: {
    uuid: { type: 'uuid', primary: true },
    name: { type: 'varchar', length: 120 },
    email: { type: 'varchar', length: 254 },
    role: { type: 'varchar', length: 20 },
    avatarIcon: nullable({ type: 'varchar', length: 40 }),
    avatarColor: nullable({ type: 'varchar', length: 20 }),
    passwordSalt: { type: 'bytea' },
    passwordHash: { type: 'bytea' },
    emailVerifiedAt: nullable({ type: 'timestamptz' }),
    disabledAt: nullable({ type: 'timestamptz' }),
    createdAt: { type: 'timestamptz' },
    totpSecret: nullable({ type: 'text' }),
    totpPendingSecret: nullable({ type: 'text' }),
    totpLastStep: { type: 'int', default: 0 },
    failedLogins: { type: 'int', default: 0 },
    lockedAt: nullable({ type: 'timestamptz' }),
  },
  indices: [{ name: 'uq_users_email', columns: ['email'], unique: true }],
});

export const RolePermissionSchema = defineTable<RolePermissionEntity>({
  name: 'role_permissions',
  tableName: 'role_permissions',
  columns: {
    ...BASE_COLUMNS,
    role: { type: 'varchar', length: 20 },
    subject: { type: 'varchar', length: 40 },
    action: { type: 'varchar', length: 20 },
    condition: { type: 'varchar', length: 20 },
  },
  indices: [{ name: 'idx_role_permissions_role', columns: ['role'] }],
});

export const MenuItemSchema = defineTable<MenuItemEntity>({
  name: 'menu_items',
  tableName: 'menu_items',
  columns: {
    ...BASE_COLUMNS,
    key: { type: 'varchar', length: 40 },
    label: { type: 'varchar', length: 60 },
    route: { type: 'varchar', length: 200 },
    group: nullable({ type: 'varchar', length: 40, name: 'menu_group' }),
    icon: nullable({ type: 'varchar', length: 43 }),
    subject: nullable({ type: 'varchar', length: 40 }),
    requiredAction: nullable({ type: 'varchar', length: 20 }),
    order: { type: 'int', name: 'sort_order' },
    active: { type: 'boolean', default: true },
  },
  indices: [{ name: 'idx_menu_items_key', columns: ['key'] }],
});

export const NotificationSchema = defineTable<NotificationEntity>({
  name: 'notifications',
  tableName: 'notifications',
  columns: {
    ...BASE_COLUMNS,
    recipientUuid: { type: 'uuid' },
    type: { type: 'varchar', length: 40 },
    message: { type: 'text' },
    resourceType: nullable({ type: 'varchar', length: 20 }),
    resourceUuid: nullable({ type: 'uuid' }),
    readAt: nullable({ type: 'timestamptz' }),
  },
  indices: [{ name: 'idx_notifications_recipient', columns: ['recipientUuid', 'createdAt'] }],
});

export const RelationshipSchema = defineTable<RelationshipEntity>({
  name: 'relationships',
  tableName: 'relationships',
  columns: {
    ...BASE_COLUMNS,
    titularUuid: { type: 'uuid' },
    alternanteUuid: { type: 'uuid' },
    status: { type: 'varchar', length: 10 },
    /** `relationship_grants` (1:N) vive aquí como `jsonb`: siempre se leen y se escriben junto con su relación. */
    grants: { type: 'jsonb', default: () => "'[]'" },
    endedAt: nullable({ type: 'timestamptz' }),
  },
  indices: [
    { name: 'idx_relationships_titular', columns: ['titularUuid'] },
    { name: 'idx_relationships_alternante', columns: ['alternanteUuid', 'status'] },
  ],
});

export const TicketSchema = defineTable<TicketEntity>({
  name: 'tickets',
  tableName: 'tickets',
  columns: {
    ...BASE_COLUMNS,
    ownerUuid: { type: 'uuid' },
    code: { type: 'varchar', length: 12 },
    title: { type: 'varchar', length: 120 },
    description: { type: 'text', default: '' },
    type: { type: 'varchar', length: 20 },
    category: { type: 'varchar', length: 20 },
    department: { type: 'varchar', length: 40, default: 'it' },
    complexity: nullable({ type: 'varchar', length: 10 }),
    otherCategoryDetail: nullable({ type: 'varchar', length: 120 }),
    priority: { type: 'varchar', length: 10 },
    status: { type: 'varchar', length: 20 },
    assigneeEmail: { type: 'varchar', length: 254, default: '' },
    estimateHours: nullable({ type: 'smallint' }),
    dueDate: nullable({ type: 'date' }),
    notifyReporter: { type: 'boolean', default: false },
    slaResponseMinutes: { type: 'int' },
    slaResolutionMinutes: { type: 'int' },
    resolution: nullable({ type: 'text' }),
    resolvedAt: nullable({ type: 'timestamptz' }),
    closedAt: nullable({ type: 'timestamptz' }),
  },
  indices: [
    { name: 'uq_tickets_code', columns: ['code'], unique: true },
    { name: 'idx_tickets_owner', columns: ['ownerUuid'] },
    { name: 'idx_tickets_status', columns: ['status'] },
    { name: 'idx_tickets_assignee', columns: ['assigneeEmail'] },
    { name: 'idx_tickets_department', columns: ['department'] },
  ],
});

/** Historial INMUTABLE: solo se inserta (no hay update ni delete en la API ni aquí). */
export const TicketEventSchema = defineTable<ITicketEvent>({
  name: 'ticket_events',
  tableName: 'ticket_events',
  columns: {
    uuid: { type: 'uuid', primary: true },
    ticketUuid: { type: 'uuid' },
    type: { type: 'varchar', length: 20 },
    at: { type: 'timestamptz' },
    actor: { type: 'varchar', length: 10 },
    visibility: { type: 'varchar', length: 10 },
    actorUuid: nullable({ type: 'uuid' }),
    actorName: { type: 'varchar', length: 120 },
    body: nullable({ type: 'text' }),
    attachments: { type: 'jsonb', default: () => "'[]'" },
    assignee: nullable({ type: 'varchar', length: 254 }),
    status: nullable({ type: 'varchar', length: 20 }),
    from: nullable({ type: 'varchar', length: 20, name: 'from_status' }),
    to: nullable({ type: 'varchar', length: 20, name: 'to_status' }),
    by: nullable({ type: 'varchar', length: 10, name: 'closed_by' }),
  },
  indices: [{ name: 'idx_ticket_events_ticket', columns: ['ticketUuid', 'at'] }],
});

export const TicketAttachmentSchema = defineTable<ITicketAttachment>({
  name: 'ticket_attachments',
  tableName: 'ticket_attachments',
  columns: {
    id: { type: 'uuid', primary: true },
    ticketUuid: { type: 'uuid' },
    name: { type: 'varchar', length: 255 },
    mimeType: { type: 'varchar', length: 100 },
    size: { type: 'int' },
    content: { type: 'bytea' },
    uploadedBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz' },
    commentUuid: nullable({ type: 'uuid' }),
  },
  indices: [{ name: 'idx_ticket_attachments_ticket', columns: ['ticketUuid'] }],
});

export const TicketSurveySchema = defineTable<ITicketSurvey>({
  name: 'ticket_surveys',
  tableName: 'ticket_surveys',
  columns: {
    ticketUuid: { type: 'uuid', primary: true },
    requesterUuid: { type: 'uuid' },
    assigneeEmail: nullable({ type: 'varchar', length: 254 }),
    sentAt: { type: 'timestamptz' },
    expiresAt: { type: 'timestamptz' },
    answeredAt: nullable({ type: 'timestamptz' }),
    score: nullable({ type: 'smallint' }),
    comment: nullable({ type: 'varchar', length: 500 }),
  },
});

export const CatalogSchema = defineTable<ICatalog>({
  name: 'catalogs',
  tableName: 'catalogs',
  columns: {
    key: { type: 'varchar', length: 40, primary: true },
    name: { type: 'varchar', length: 60 },
    description: { type: 'varchar', length: 200, default: '' },
    system: { type: 'boolean', default: false },
    createdAt: { type: 'timestamptz' },
  },
});

export const CatalogItemSchema = defineTable<ICatalogItem>({
  name: 'catalog_items',
  tableName: 'catalog_items',
  columns: {
    uuid: { type: 'uuid', primary: true },
    catalogKey: { type: 'varchar', length: 40 },
    code: { type: 'varchar', length: 40 },
    label: { type: 'varchar', length: 80 },
    order: { type: 'int', name: 'sort_order' },
    active: { type: 'boolean', default: true },
    system: { type: 'boolean', default: false },
    icon: nullable({ type: 'varchar', length: 43 }),
    severity: nullable({ type: 'varchar', length: 10 }),
  },
  indices: [{ name: 'uq_catalog_items_code', columns: ['catalogKey', 'code'], unique: true }],
});

/** Todas las tablas gestionadas por TypeORM (`audit_logs` la gestiona su propio almacén; ver la migración inicial). */
export const ENTITY_SCHEMAS = [
  UserSchema,
  RolePermissionSchema,
  MenuItemSchema,
  NotificationSchema,
  RelationshipSchema,
  TicketSchema,
  TicketEventSchema,
  TicketAttachmentSchema,
  TicketSurveySchema,
  CatalogSchema,
  CatalogItemSchema,
];

import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { withBadges } from '../../shared/dynamic-form/utils/with-badges.util';
import { toOptions } from '../../shared/dynamic-form/utils/to-options.util';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, AuditLogViewSchema } from './audit-log.schema';
import { AUDIT_ACTION_BADGES, AUDIT_ACTION_LABELS, AUDIT_OUTCOME_BADGES, AUDIT_OUTCOME_LABELS } from './audit-log.constants';

const readonly = { readonly: true } as const;

/** Detalle de una entrada (solo vista): nada se edita en la auditoría. */
export const AUDIT_LOG_FORM = defineForm({
  name: 'AUDIT_LOG_FORM',
  schema: AuditLogViewSchema,
  fields: [
    { key: 'at', label: 'Fecha y hora', type: FieldType.TEXT, state: readonly },
    { key: 'actorEmail', label: 'Quién', type: FieldType.TEXT, state: readonly },
    { key: 'actorRole', label: 'Rol', type: FieldType.TEXT, state: readonly },
    { key: 'action', label: 'Acción', type: FieldType.TEXT, state: readonly },
    { key: 'outcome', label: 'Resultado', type: FieldType.TEXT, state: readonly },
    { key: 'status', label: 'Código HTTP', type: FieldType.TEXT, state: readonly },
    { key: 'method', label: 'Método', type: FieldType.TEXT, state: readonly },
    { key: 'route', label: 'Ruta', type: FieldType.TEXT, state: readonly, fullWidth: true },
    { key: 'resourceUuid', label: 'Recurso afectado', type: FieldType.TEXT, state: readonly, fullWidth: true },
    {
      key: 'changedFields',
      label: 'Campos enviados',
      type: FieldType.TEXT,
      state: readonly,
      hint: 'Solo los NOMBRES de los campos: nunca se guardan sus valores.',
      fullWidth: true,
    },
    { key: 'ip', label: 'IP', type: FieldType.TEXT, state: readonly },
    { key: 'requestId', label: 'Id de petición', type: FieldType.TEXT, state: readonly },
    { key: 'userAgent', label: 'Navegador', type: FieldType.TEXT, state: readonly, fullWidth: true },
  ],
});

export const AUDIT_LOG_TABLE: ITableConfig = {
  caption: 'Registro de auditoría',
  subject: 'AuditLog',
  creatable: false,
  rowLabelField: 'route',
  columns: [
    { field: 'at', header: 'Fecha', dataType: 'datetime' },
    { field: 'actorEmail', header: 'Quién' },
    {
      field: 'action',
      header: 'Acción',
      badge: true,
      options: withBadges(toOptions(AUDIT_ACTIONS, AUDIT_ACTION_LABELS), AUDIT_ACTION_BADGES),
    },
    { field: 'subject', header: 'Recurso' },
    {
      field: 'outcome',
      header: 'Resultado',
      badge: true,
      options: withBadges(toOptions(AUDIT_OUTCOMES, AUDIT_OUTCOME_LABELS), AUDIT_OUTCOME_BADGES),
    },
    { field: 'status', header: 'HTTP', dataType: 'string' },
  ],
  actions: ['view'],
};

/** Opciones de los filtros de la pantalla. */
export const AUDIT_ACTION_OPTIONS = toOptions(AUDIT_ACTIONS, AUDIT_ACTION_LABELS);
export const AUDIT_OUTCOME_OPTIONS = toOptions(AUDIT_OUTCOMES, AUDIT_OUTCOME_LABELS);

export const AUDIT_LOG_CRUD: ICrudConfig<typeof AuditLogViewSchema> = {
  entity: 'entrada',
  article: 'la',
  table: AUDIT_LOG_TABLE,
  form: AUDIT_LOG_FORM,
  // La API trae `null` y arreglos: el modal de detalle muestra texto.
  toFormValue: (row) => ({
    at: new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(String(row['at']))),
    actorEmail: String(row['actorEmail'] ?? '(sin sesión)'),
    actorRole: String(row['actorRole'] ?? '—'),
    action: String(row['action'] ?? ''),
    outcome: String(row['outcome'] ?? ''),
    status: String(row['status'] ?? ''),
    method: String(row['method'] ?? ''),
    route: String(row['route'] ?? ''),
    resourceUuid: String(row['resourceUuid'] ?? '—'),
    changedFields: ((row['changedFields'] as string[] | undefined) ?? []).join(', ') || '—',
    ip: String(row['ip'] ?? ''),
    requestId: String(row['requestId'] ?? '—'),
    userAgent: String(row['userAgent'] ?? ''),
  }),
  rowName: (row) => `${String(row['method'])} ${String(row['route'])}`,
};

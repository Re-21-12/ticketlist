import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { RelationshipAdminViewSchema } from './relationship-admin.schema';
import type { TRelationshipAdmin } from './relationship-admin.types';

export const RELATIONSHIP_STATUS_LABELS = { ACTIVE: 'Activa', REVOKED: 'Revocada' } as const;

const readonly = { readonly: true } as const;
const when = (iso: string | null): string =>
  iso ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

/** Qué puede hacer el alternante, en palabras (el estado no depende de íconos ni de color). */
export function summarizeGrants(row: Pick<TRelationshipAdmin, 'canRead' | 'canUpdate'>): string {
  return [row.canRead ? 'leer' : '', row.canUpdate ? 'editar' : '']
    .filter(Boolean)
    .join(' · ') || 'nada';
}

/** Detalle de una relación (solo vista): nada se edita aquí, solo se revoca. */
export const RELATIONSHIP_ADMIN_FORM = defineForm({
  name: 'RELATIONSHIP_ADMIN_FORM',
  schema: RelationshipAdminViewSchema,
  fields: [
    { key: 'titular', label: 'Titular (comparte)', type: FieldType.TEXT, state: readonly, fullWidth: true },
    { key: 'alternante', label: 'Alternante (recibe)', type: FieldType.TEXT, state: readonly, fullWidth: true },
    { key: 'status', label: 'Estado', type: FieldType.TEXT, state: readonly },
    { key: 'grants', label: 'Puede', type: FieldType.TEXT, state: readonly },
    { key: 'consent', label: 'Consentimiento', type: FieldType.TEXT, state: readonly, fullWidth: true },
    { key: 'createdAt', label: 'Desde', type: FieldType.TEXT, state: readonly },
    { key: 'endedAt', label: 'Revocada el', type: FieldType.TEXT, state: readonly },
  ],
});

export const RELATIONSHIP_ADMIN_TABLE: ITableConfig = {
  caption: 'Relaciones entre personas',
  subject: 'Relationship',
  creatable: false,
  rowLabelField: 'alternanteEmail',
  deleteLabel: 'Revocar',
  columns: [
    { field: 'titularEmail', header: 'Titular' },
    { field: 'alternanteEmail', header: 'Alternante' },
    {
      field: 'status',
      header: 'Estado',
      badge: true,
      options: [
        { value: 'ACTIVE', label: RELATIONSHIP_STATUS_LABELS.ACTIVE, icon: 'pi-check-circle', severity: 'success' },
        { value: 'REVOKED', label: RELATIONSHIP_STATUS_LABELS.REVOKED, icon: 'pi-ban', severity: 'secondary' },
      ],
    },
    { field: 'canUpdate', header: 'Edita', dataType: 'boolean' },
    { field: 'createdAt', header: 'Desde', dataType: 'datetime' },
  ],
  actions: ['view', 'delete'],
  // Solo se revoca lo que sigue activo: una revocada es historial.
  rowActionAllowed: (action, row) => action !== 'delete' || row['status'] === 'ACTIVE',
};

export const RELATIONSHIP_ADMIN_CRUD: ICrudConfig<typeof RelationshipAdminViewSchema> = {
  entity: 'relación',
  article: 'la',
  table: RELATIONSHIP_ADMIN_TABLE,
  form: RELATIONSHIP_ADMIN_FORM,
  deleteVerb: { label: 'Revocar', stem: 'revocad' },
  toFormValue: (row) => {
    const r = row as unknown as TRelationshipAdmin;
    return {
      titular: `${r.titularName} (${r.titularEmail})`,
      alternante: `${r.alternanteName} (${r.alternanteEmail})`,
      status: RELATIONSHIP_STATUS_LABELS[r.status],
      grants: summarizeGrants(r),
      consent: r.consentVersion ? `Versión ${r.consentVersion}, aceptada el ${when(r.consentedAt)}` : '—',
      createdAt: when(r.createdAt),
      endedAt: when(r.endedAt),
    };
  },
  rowName: (row) => `${String(row['titularEmail'])} → ${String(row['alternanteEmail'])}`,
  deleteMessage: (row) =>
    `¿Revocar el acceso de ${String(row['alternanteEmail'])} a los tickets de ${String(row['titularEmail'])}? Lo pierde de inmediato, se avisa a las dos personas y el historial se conserva.`,
};

import { EAbility, EUserRole } from '../../core/casl/ability.enum';
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  CONDITION_PRESETS,
  SUBJECT_LABELS,
} from '../../core/casl/casl-labels.constants';
import { ROLE_LABELS } from '../../core/casl/role-labels.constants';
import { SUBJECTS } from '../../core/casl/casl.types';
import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { toOptions } from '../../shared/dynamic-form/utils/to-options.util';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import { RolePermissionUpsertSchema } from './role-permission.schema';

export const ROLE_PERMISSION_FORM = defineForm({
  name: 'ROLE_PERMISSION_FORM',
  schema: RolePermissionUpsertSchema,
  fields: [
    {
      key: 'role',
      label: 'Rol',
      type: FieldType.SELECT,
      options: toOptions(Object.values(EUserRole), ROLE_LABELS),
      table: { show: true },
    },
    {
      key: 'subject',
      label: 'Recurso',
      type: FieldType.SELECT,
      options: toOptions(SUBJECTS, SUBJECT_LABELS),
      table: { show: true },
    },
    {
      key: 'action',
      label: 'Acción',
      type: FieldType.SELECT,
      options: toOptions(Object.values(EAbility), ACTION_LABELS),
      table: { show: true },
    },
    {
      key: 'condition',
      label: 'Condición',
      type: FieldType.SELECT,
      options: toOptions(CONDITION_PRESETS, CONDITION_LABELS),
      hint: 'Limita el permiso a una parte del recurso. Solo tiene sentido en Tickets.',
      fullWidth: true,
      table: { show: true },
    },
  ],
});

export const ROLE_PERMISSION_TABLE: ITableConfig = {
  caption: 'Permisos por rol',
  subject: 'RolePermission',
  createLabel: 'Nuevo permiso',
  columns: buildTableColumns(ROLE_PERMISSION_FORM.fields),
  actions: ['view', 'update', 'delete'],
};

export const ROLE_PERMISSION_CRUD: ICrudConfig<typeof RolePermissionUpsertSchema> = {
  entity: 'permiso',
  article: 'el',
  table: ROLE_PERMISSION_TABLE,
  form: ROLE_PERMISSION_FORM,
  createDefaults: { condition: 'NONE' },
  rowName: (row) =>
    `${ROLE_LABELS[row['role'] as EUserRole]} · ${SUBJECT_LABELS[row['subject'] as keyof typeof SUBJECT_LABELS]} · ${ACTION_LABELS[row['action'] as EAbility]}`,
  deleteMessage: (row) =>
    `¿Quitarle este permiso a ${ROLE_LABELS[row['role'] as EUserRole]}? Las personas de ese rol lo pierden en su próxima carga.`,
};

import { EUserRole } from '../../core/casl/ability.enum';
import { ROLE_LABELS } from '../../core/casl/role-labels.constants';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { withBadges } from '../../shared/dynamic-form/utils/with-badges.util';
import { ROLE_BADGES } from '../../core/casl/role-labels.constants';
import { toOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { UserFormSchema } from './user.schema';

export const USER_FORM = defineForm({
  name: 'USER_FORM',
  schema: UserFormSchema,
  fields: [
    { key: 'name', label: 'Nombre', type: FieldType.TEXT, state: { readonly: true }, table: { show: true } },
    { key: 'email', label: 'Correo', type: FieldType.EMAIL, state: { readonly: true }, table: { show: true } },
    {
      key: 'role',
      label: 'Rol',
      type: FieldType.SELECT,
      options: withBadges(toOptions(Object.values(EUserRole), ROLE_LABELS), ROLE_BADGES),
      hint: 'Rige desde la siguiente petición de la persona. No puedes cambiar tu propio rol.',
      table: { show: true, badge: true },
    },
    {
      key: 'locked',
      label: 'Cuenta bloqueada',
      type: FieldType.TOGGLE,
      toggleLabels: { on: 'Bloqueada por intentos fallidos', off: 'Desbloqueada' },
      hint: 'Se bloquea sola tras 5 intentos fallidos de inicio de sesión. Apágalo para desbloquearla cuando la persona se comunique contigo.',
      fullWidth: true,
      table: { show: true, dangerWhenTrue: true },
    },
    {
      key: 'disabled',
      label: 'Cuenta deshabilitada',
      type: FieldType.TOGGLE,
      toggleLabels: { on: 'Deshabilitada: no puede entrar', off: 'Activa' },
      hint: 'Al deshabilitarla se cierran todas sus sesiones. Se puede reactivar.',
      fullWidth: true,
      table: { show: true, dangerWhenTrue: true },
    },
  ],
});

export const USER_TABLE: ITableConfig = {
  caption: 'Usuarios',
  subject: 'User',
  creatable: false,
  rowLabelField: 'name',
  columns: [
    ...buildTableColumns(USER_FORM.fields),
    { field: 'emailVerified', header: 'Correo verificado', dataType: 'boolean' },
    { field: 'createdAt', header: 'Alta', dataType: 'datetime' },
  ],
  actions: ['view', 'update'],
};

export const USER_CRUD: ICrudConfig<typeof UserFormSchema> = {
  entity: 'usuario',
  article: 'el',
  table: USER_TABLE,
  form: USER_FORM,
  rowName: (row) => String(row['name'] ?? row['email'] ?? ''),
};

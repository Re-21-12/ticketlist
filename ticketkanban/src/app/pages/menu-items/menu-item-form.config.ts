import { EAbility } from '../../core/casl/ability.enum';
import { ACTION_LABELS, SUBJECT_LABELS } from '../../core/casl/casl-labels.constants';
import { SUBJECTS } from '../../core/casl/casl.types';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import { FieldType, type IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { toOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { MenuItemUpsertSchema } from './menu-item.schema';

/** Opción «vacía»: se guarda como `null` (el schema convierte `''`). */
const NONE = (label: string): IFieldOption => ({ value: '', label });

export const MENU_ITEM_FORM = defineForm({
  name: 'MENU_ITEM_FORM',
  schema: MenuItemUpsertSchema,
  fields: [
    {
      key: 'label',
      label: 'Etiqueta',
      type: FieldType.TEXT,
      placeholder: 'Ej. Reportes',
      table: { show: true },
    },
    {
      key: 'key',
      label: 'Clave',
      type: FieldType.TEXT,
      placeholder: 'reportes',
      hint: 'Identificador único: minúsculas, números y guiones.',
      table: { show: true },
    },
    {
      key: 'route',
      label: 'Ruta',
      type: FieldType.TEXT,
      placeholder: '/reportes',
      hint: 'Una ruta interna. Si la pantalla aún no existe, el ítem no se muestra.',
      fullWidth: true,
      table: { show: true },
    },
    {
      key: 'group',
      label: 'Grupo',
      type: FieldType.TEXT,
      placeholder: 'Administración',
      table: { show: true },
    },
    {
      key: 'icon',
      label: 'Ícono',
      type: FieldType.TEXT,
      placeholder: 'pi-chart-bar',
      hint: 'Clase de PrimeIcons.',
      table: { show: true, iconValue: true },
    },
    {
      key: 'subject',
      label: 'Visible para quien pueda…',
      type: FieldType.SELECT,
      options: [NONE('Cualquier persona con sesión'), ...toOptions(SUBJECTS, SUBJECT_LABELS)],
      hint: 'Recurso que se evalúa con CASL.',
      table: { show: true },
    },
    {
      key: 'requiredAction',
      label: 'Acción requerida',
      type: FieldType.SELECT,
      options: [NONE('Leer (por defecto)'), ...toOptions(Object.values(EAbility), ACTION_LABELS)],
    },
    { key: 'order', label: 'Orden', type: FieldType.INTEGER, hint: 'Menor número, más arriba.', table: { show: true } },
    {
      key: 'active',
      label: 'Visible',
      type: FieldType.TOGGLE,
      toggleLabels: { on: 'Se muestra', off: 'Oculto' },
      table: { show: true },
    },
  ],
});

export const MENU_ITEM_TABLE: ITableConfig = {
  caption: 'Ítems del menú',
  subject: 'MenuItem',
  createLabel: 'Nuevo ítem',
  rowLabelField: 'label',
  columns: buildTableColumns(MENU_ITEM_FORM.fields),
  actions: ['view', 'update', 'delete'],
};

export const MENU_ITEM_CRUD: ICrudConfig<typeof MenuItemUpsertSchema> = {
  entity: 'ítem de menú',
  article: 'el',
  table: MENU_ITEM_TABLE,
  form: MENU_ITEM_FORM,
  createDefaults: { order: 100, active: true, subject: '', requiredAction: '', group: '', icon: '' },
  // Los campos opcionales llegan `null`: un `<input>` de texto con `null` revienta (NG01921), se muestran vacíos.
  toFormValue: (row) => ({
    ...row,
    group: (row['group'] as string | null) ?? '',
    icon: (row['icon'] as string | null) ?? '',
    subject: (row['subject'] as string | null) ?? '',
    requiredAction: (row['requiredAction'] as string | null) ?? '',
  }),
  rowName: (row) => String(row['label'] ?? row['key'] ?? ''),
  deleteMessage: (row) => `¿Quitar «${String(row['label'])}» del menú? Deja de verse en la siguiente carga de sesión.`,
};

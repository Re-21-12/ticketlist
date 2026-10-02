import { FieldType, type IFieldConfig } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import {
  CATALOG_SEVERITIES,
  CATALOG_SEVERITY_LABELS,
  CatalogCreateSchema,
  CatalogItemUpsertSchema,
  CatalogUpdateSchema,
} from './catalog.schema';

const SEVERITY_OPTIONS = [
  { value: '', label: 'Sin color' },
  ...CATALOG_SEVERITIES.map((value) => ({ value, label: CATALOG_SEVERITY_LABELS[value], severity: value })),
];

export const CATALOG_CREATE_FORM = defineForm({
  name: 'CATALOG_CREATE_FORM',
  schema: CatalogCreateSchema,
  fields: [
    { key: 'name', label: 'Nombre', type: FieldType.TEXT, placeholder: 'Ej. Sedes' },
    {
      key: 'key',
      label: 'Clave',
      type: FieldType.TEXT,
      placeholder: 'sedes',
      hint: 'Identificador único: minúsculas, números y guiones. No se puede cambiar después.',
    },
    { key: 'description', label: 'Descripción', type: FieldType.TEXTAREA, rows: 3, fullWidth: true },
  ],
});

export const CATALOG_UPDATE_FORM = defineForm({
  name: 'CATALOG_UPDATE_FORM',
  schema: CatalogUpdateSchema,
  fields: [
    { key: 'name', label: 'Nombre', type: FieldType.TEXT },
    { key: 'description', label: 'Descripción', type: FieldType.TEXTAREA, rows: 3, fullWidth: true },
  ],
});

const itemFields = (system: boolean): IFieldConfig<'code' | 'label' | 'icon' | 'severity' | 'order' | 'active'>[] => [
  {
    key: 'code',
    label: 'Código',
    type: FieldType.TEXT,
    placeholder: 'NORTE',
    hint: system
      ? 'Elemento de sistema: el código lo usa el programa y no cambia.'
      : 'Letras, números y guion bajo. Es el valor que se guarda.',
    state: system ? { readonly: true } : {},
    table: { show: true },
  },
  {
    key: 'label',
    label: 'Etiqueta',
    type: FieldType.TEXT,
    placeholder: 'Zona norte',
    // La etiqueta se ve como la verá quien use el formulario: insignia con su ícono y color.
    table: { show: true, badgeFrom: { icon: 'icon', severity: 'severity' } },
  },
  {
    key: 'icon',
    label: 'Ícono',
    type: FieldType.TEXT,
    placeholder: 'pi-clock',
    hint: 'Clase de PrimeIcons (pi-…). Vacío = sin ícono.',
    table: { show: true, iconValue: true },
  },
  {
    key: 'severity',
    label: 'Color',
    type: FieldType.SELECT,
    options: SEVERITY_OPTIONS,
    hint: 'Color de la insignia. El texto siempre se muestra junto al color.',
  },
  { key: 'order', label: 'Orden', type: FieldType.INTEGER, hint: 'Menor número, primero.', table: { show: true } },
  {
    key: 'active',
    label: 'Disponible',
    type: FieldType.TOGGLE,
    toggleLabels: { on: 'Se ofrece en los formularios', off: 'Oculto' },
    state: system
      ? { disabled: true, disabledReason: 'Un elemento de sistema siempre está disponible.' }
      : {},
    fullWidth: true,
    table: { show: true },
  },
];

export const CATALOG_ITEM_FORM = defineForm({
  name: 'CATALOG_ITEM_FORM',
  schema: CatalogItemUpsertSchema,
  fields: itemFields(false),
});

/** Elementos de sistema: código y «disponible» bloqueados (el backend también los protege: `RCAT-E004`). */
export const CATALOG_ITEM_SYSTEM_FORM = defineForm({
  name: 'CATALOG_ITEM_SYSTEM_FORM',
  schema: CatalogItemUpsertSchema,
  fields: itemFields(true),
});

export const CATALOG_ITEM_TABLE: ITableConfig = {
  caption: 'Elementos del catálogo',
  subject: 'Catalog',
  createLabel: 'Nuevo elemento',
  rowLabelField: 'code',
  columns: [
    ...buildTableColumns(CATALOG_ITEM_FORM.fields),
    { field: 'system', header: 'Sistema', dataType: 'boolean' },
  ],
  actions: ['update', 'delete'],
  // Lo de sistema se edita (etiqueta, orden) pero nunca se elimina.
  rowActionAllowed: (action, row) => !(action === 'delete' && row['system'] === true),
};

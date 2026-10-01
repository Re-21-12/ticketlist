import { FieldType, type IFieldConfig } from '../../dynamic-form/field-config.interface';
import type { ITableColumn } from '../dynamic-table.interface';

const DATA_TYPE_BY_FIELD: Partial<Record<IFieldConfig['type'], ITableColumn['dataType']>> = {
  [FieldType.NUMBER]: 'number',
  [FieldType.INTEGER]: 'number',
  [FieldType.DECIMAL]: 'number',
  [FieldType.CURRENCY]: 'number',
  [FieldType.SLIDER]: 'number',
  [FieldType.DATE]: 'date',
  [FieldType.DATETIME]: 'date',
  [FieldType.CHECKBOX]: 'boolean',
  [FieldType.TOGGLE]: 'boolean',
  [FieldType.TOGGLE_BUTTON]: 'boolean',
};

/**
 * Columnas de `app-dynamic-table` derivadas de la MISMA config de campos del formulario (port de
 * `buildTableColumns` de wallet-api): evita mantener dos listas que se desincronizan. Un SELECT
 * aporta sus `options` para que la celda muestre la etiqueta. `extra`: columnas que no vienen del
 * form (p. ej. `code`, generado por el backend).
 */
export function buildTableColumns(
  fields: readonly IFieldConfig[],
  extra: ITableColumn[] = [],
): ITableColumn[] {
  const fromFields = fields
    .filter((field) => field.table?.show)
    .map<ITableColumn>((field) => ({
      field: field.key,
      header: field.table?.header ?? field.label,
      dataType: field.table?.dataType ?? DATA_TYPE_BY_FIELD[field.type] ?? 'string',
      options: field.options,
    }));
  return [...extra, ...fromFields];
}

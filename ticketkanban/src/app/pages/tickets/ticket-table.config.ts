import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import { TICKET_FORM } from './ticket-form.config';

/**
 * Tabla de tickets: las columnas salen de `TICKET_FORM` (campos con `table.show`) — una sola
 * config para formulario y tabla. `code` no está en el form (lo genera el backend) → `extra`.
 */
export const TICKET_TABLE: ITableConfig = {
  caption: 'Listado de tickets',
  subject: 'Ticket',
  createLabel: 'Nuevo ticket',
  columns: buildTableColumns(TICKET_FORM.fields, [{ field: 'code', header: 'Código' }]),
  actions: ['view', 'update', 'delete'],
};

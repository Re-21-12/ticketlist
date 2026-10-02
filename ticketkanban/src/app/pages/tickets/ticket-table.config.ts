import type { ITableConfig } from '../../shared/dynamic-table/dynamic-table.interface';
import { buildTableColumns } from '../../shared/dynamic-table/utils/build-columns';
import { toMetaOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { TICKET_STATUS_META } from './ticket.constants';
import { TICKET_STATUS } from './ticket.schema';
import { TICKET_FORM } from './ticket-form.config';

/**
 * Tabla de tickets: las columnas salen de `TICKET_FORM` (campos con `table.show`) — una sola
 * config para formulario y tabla. `code` no está en el form (lo genera el backend) → `extra`.
 */
export const TICKET_TABLE: ITableConfig = {
  caption: 'Listado de tickets',
  subject: 'Ticket',
  createLabel: 'Nuevo ticket',
  columns: buildTableColumns(TICKET_FORM.fields, [
    { field: 'code', header: 'Código' },
    // El estado ya no es un campo del formulario (solo cambia por transición): columna propia.
    { field: 'status', header: 'Estado', badge: true, options: toMetaOptions(TICKET_STATUS, TICKET_STATUS_META) },
    { field: 'assigneeName', header: 'Atiende' },
  ]),
  actions: ['view', 'update', 'delete'],
};

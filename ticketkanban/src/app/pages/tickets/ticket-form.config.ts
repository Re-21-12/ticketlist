import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { FieldType, type IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TicketQuickCreateSchema,
  TicketUpsertSchema,
} from './ticket.schema';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from './ticket.constants';

/** Opciones derivadas de los enums del contrato: imposible que el select ofrezca un valor que Zod rechace. */
function toOptions<T extends string>(values: readonly T[], labels: Record<T, string>): IFieldOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

const CATEGORY_OPTIONS = toOptions(TICKET_CATEGORY, TICKET_CATEGORY_LABELS);
const PRIORITY_OPTIONS = toOptions(TICKET_PRIORITY, TICKET_PRIORITY_LABELS);

/** Formulario completo (modal): 10 campos → stepper de 3 pasos con secciones explícitas. */
export const TICKET_FORM = defineForm({
  name: 'TICKET_FORM',
  schema: TicketUpsertSchema,
  layout: 'stepper',
  sections: [
    {
      key: 'general',
      label: 'General',
      fieldKeys: ['title', 'category', 'otherCategoryDetail', 'description'],
    },
    {
      key: 'planning',
      label: 'Planificación',
      fieldKeys: ['priority', 'status', 'estimateHours', 'dueDate'],
    },
    { key: 'people', label: 'Personas', fieldKeys: ['assigneeEmail', 'notifyReporter'] },
  ],
  fields: [
    {
      key: 'title',
      label: 'Título',
      type: FieldType.TEXT,
      placeholder: 'Ej. El login falla con Google',
      fullWidth: true,
      table: { show: true },
    },
    {
      key: 'category',
      label: 'Categoría',
      type: FieldType.SELECT,
      options: CATEGORY_OPTIONS,
      table: { show: true },
      revealField: [{ key: 'otherCategoryDetail', whenValue: 'other' }],
    },
    {
      key: 'otherCategoryDetail',
      label: '¿Cuál?',
      type: FieldType.TEXT,
      placeholder: 'Describe la categoría',
      state: { hidden: true },
    },
    {
      key: 'description',
      label: 'Descripción',
      type: FieldType.TEXTAREA,
      hint: 'Pasos para reproducir, contexto, capturas…',
      fullWidth: true,
    },
    {
      key: 'priority',
      label: 'Prioridad',
      type: FieldType.SELECT,
      options: PRIORITY_OPTIONS,
      table: { show: true },
    },
    {
      key: 'status',
      label: 'Estado',
      type: FieldType.SELECT,
      options: toOptions(TICKET_STATUS, TICKET_STATUS_LABELS),
      table: { show: true },
    },
    // INTEGER (no NUMBER): el schema exige un entero 1–200; el control no admite decimales ni signo.
    { key: 'estimateHours', label: 'Estimación (horas)', type: FieldType.INTEGER },
    { key: 'dueDate', label: 'Fecha límite', type: FieldType.DATE, table: { show: true } },
    {
      key: 'assigneeEmail',
      label: 'Asignado a',
      type: FieldType.EMAIL,
      placeholder: 'correo@empresa.com',
      hint: 'Déjalo vacío si aún no tiene responsable',
      fullWidth: true,
      table: { show: true },
    },
    {
      key: 'notifyReporter',
      label: 'Notificar al solicitante',
      type: FieldType.TOGGLE,
      toggleLabels: { on: 'Sí, avisar', off: 'No avisar' },
      fullWidth: true,
    },
  ],
});

/** Alta rápida (pantalla con FormSplit): 4 campos → grid plano, sin stepper. */
export const TICKET_QUICK_FORM = defineForm({
  name: 'TICKET_QUICK_FORM',
  schema: TicketQuickCreateSchema,
  fields: [
    { key: 'title', label: 'Título', type: FieldType.TEXT, placeholder: 'Resumen en una línea' },
    { key: 'category', label: 'Categoría', type: FieldType.SELECT, options: CATEGORY_OPTIONS },
    { key: 'priority', label: 'Prioridad', type: FieldType.SELECT, options: PRIORITY_OPTIONS },
    { key: 'description', label: 'Descripción', type: FieldType.TEXTAREA, rows: 5 },
  ],
});

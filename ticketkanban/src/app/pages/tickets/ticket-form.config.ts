import type * as z from 'zod';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { FieldType, type IFieldConfig } from '../../shared/dynamic-form/field-config.interface';
import { toMetaOptions } from '../../shared/dynamic-form/utils/to-options.util';
import {
  TICKET_CATEGORY,
  TICKET_COMPLEXITY,
  TICKET_PRIORITY,
  TICKET_TYPE,
  TicketQuickCreateSchema,
  TicketResolveFormSchema,
  TicketUpsertSchema,
} from './ticket.schema';
import {
  TICKET_CATEGORY_META,
  TICKET_COMPLEXITY_META,
  TICKET_DEPARTMENT_FALLBACK,
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
} from './ticket.constants';

const TYPE_OPTIONS = toMetaOptions(TICKET_TYPE, TICKET_TYPE_META);
const CATEGORY_OPTIONS = toMetaOptions(TICKET_CATEGORY, TICKET_CATEGORY_META);
const PRIORITY_OPTIONS = toMetaOptions(TICKET_PRIORITY, TICKET_PRIORITY_META);
const COMPLEXITY_OPTIONS = toMetaOptions(TICKET_COMPLEXITY, TICKET_COMPLEXITY_META);

const DEPARTMENT_FALLBACK_OPTION = { value: TICKET_DEPARTMENT_FALLBACK.value, label: TICKET_DEPARTMENT_FALLBACK.label, icon: TICKET_DEPARTMENT_FALLBACK.icon, severity: TICKET_DEPARTMENT_FALLBACK.severity };

const TEAM_ONLY = 'Solo el equipo de soporte lo define.';

/** Lo que el cliente ve pero no cambia: viaja igual en el cuerpo (el PATCH es completo) y el backend lo ignora. */
type TKey = keyof z.input<typeof TicketUpsertSchema> & string;

const teamOnly = (field: IFieldConfig<TKey>): IFieldConfig<TKey> => ({
  ...field,
  state: { ...field.state, disabled: true, disabledReason: TEAM_ONLY },
});

/**
 * Campos del formulario de ticket (CU05): clasificación (tipo, categoría), urgencia (select con ícono y
 * color del catálogo), complejidad (la fija el equipo).
 * Las columnas de la tabla salen de AQUÍ (`table`): tipo, categoría, prioridad y complejidad como insignias.
 */
const TICKET_FIELDS: IFieldConfig<TKey>[] = [
  {
    key: 'title',
    label: 'Título',
    type: FieldType.TEXT,
    placeholder: 'Ej. El login falla con Google',
    fullWidth: true,
    table: { show: true },
  },
  {
    key: 'department',
    label: 'Departamento de origen',
    type: FieldType.SELECT,
    options: [DEPARTMENT_FALLBACK_OPTION],
    placeholder: 'De qué área viene la solicitud',
    hint: 'Elige «TI (interno)» si la solicitud nace dentro del propio equipo de TI.',
    table: { show: true, badge: true },
  },
  {
    key: 'type',
    label: 'Tipo de incidencia',
    type: FieldType.SELECT,
    options: TYPE_OPTIONS,
    table: { show: true, badge: true },
  },
  {
    key: 'category',
    label: 'Categoría',
    type: FieldType.SELECT,
    options: CATEGORY_OPTIONS,
    table: { show: true, badge: true },
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
    type: FieldType.EDITOR,
    rows: 7,
    hint: 'Pasos para reproducir, contexto, capturas… Puedes dar formato (listas, negrita, enlaces).',
    fullWidth: true,
  },
  {
    key: 'priority',
    label: 'Urgencia',
    type: FieldType.SELECT,
    options: PRIORITY_OPTIONS,
    table: { show: true, badge: true },
  },
  {
    key: 'complexity',
    label: 'Complejidad',
    type: FieldType.SELECT,
    options: COMPLEXITY_OPTIONS,
    placeholder: 'Sin evaluar',
    table: { show: true, badge: true },
  },
  // INTEGER (no NUMBER): el schema exige un entero 1–200; el control no admite decimales ni signo.
  { key: 'estimateHours', label: 'Estimación (horas)', type: FieldType.INTEGER },
  { key: 'dueDate', label: 'Fecha límite', type: FieldType.DATE, table: { show: true } },
  {
    key: 'assigneeEmail',
    label: 'Asignado a',
    // SELECT, no texto libre: las opciones (el personal disponible) llegan del backend en runtime
    // (`optionsByField`); con más de 5 personas se vuelve un autocomplete.
    type: FieldType.SELECT,
    options: [{ value: '', label: 'Sin asignar' }],
    placeholder: 'Elige a quién asignarlo',
    hint: 'Solo personal con rol de Agente o Administrador. «Sin asignar» lo deja sin responsable.',
    fullWidth: true,
  },
  {
    key: 'notifyReporter',
    label: 'Notificar al solicitante',
    type: FieldType.TOGGLE,
    toggleLabels: { on: 'Sí, avisar', off: 'No avisar' },
    fullWidth: true,
  },
];

const TICKET_SECTIONS = [
  {
    key: 'general',
    label: 'Clasificación',
    fieldKeys: ['title', 'department', 'type', 'category', 'otherCategoryDetail', 'description'],
  },
  {
    key: 'planning',
    label: 'Urgencia y plan',
    fieldKeys: ['priority', 'complexity', 'estimateHours', 'dueDate'],
  },
  { key: 'people', label: 'Personas', fieldKeys: ['assigneeEmail', 'notifyReporter'] },
] as const satisfies readonly { key: string; label: string; fieldKeys: readonly TKey[] }[];

/** Formulario del EQUIPO (modal): stepper de 3 pasos; fija complejidad, estimación y responsable. */
export const TICKET_FORM = defineForm({
  name: 'TICKET_FORM',
  schema: TicketUpsertSchema,
  layout: 'stepper',
  sections: TICKET_SECTIONS.map((section) => ({ ...section, fieldKeys: [...section.fieldKeys] })),
  fields: TICKET_FIELDS,
});

/**
 * Formulario del CLIENTE: mismos campos, pero complejidad, estimación, fecha límite y responsable se ven sin poder
 * cambiarse (solo el equipo los define; el backend los ignora aunque se envíen).
 */
export const TICKET_CUSTOMER_FORM = defineForm({
  name: 'TICKET_CUSTOMER_FORM',
  schema: TicketUpsertSchema,
  layout: 'stepper',
  sections: TICKET_SECTIONS.map((section) => ({ ...section, fieldKeys: [...section.fieldKeys] })),
  fields: TICKET_FIELDS.map((field) =>
    ['complexity', 'estimateHours', 'dueDate', 'assigneeEmail'].includes(field.key) ? teamOnly(field) : field,
  ),
});

/** Modal «Resolver»: documentar la solución es obligatorio para poder resolver (el requerimiento: «se documentará»). */
export const TICKET_RESOLVE_FORM = defineForm({
  name: 'TICKET_RESOLVE_FORM',
  schema: TicketResolveFormSchema,
  fields: [
    {
      key: 'resolution',
      label: 'Solución',
      type: FieldType.TEXTAREA,
      rows: 5,
      hint: 'Qué se hizo para resolverlo. La persona que lo solicitó la verá y podrá confirmar el cierre o reabrirlo.',
      fullWidth: true,
    },
  ],
});

/** Alta rápida (pantalla con FormSplit): 5 campos → grid plano, sin stepper. */
export const TICKET_QUICK_FORM = defineForm({
  name: 'TICKET_QUICK_FORM',
  schema: TicketQuickCreateSchema,
  fields: [
    { key: 'title', label: 'Título', type: FieldType.TEXT, placeholder: 'Resumen en una línea' },
    { key: 'department', label: 'Departamento de origen', type: FieldType.SELECT, options: [DEPARTMENT_FALLBACK_OPTION], hint: 'Elige «TI (interno)» si nace dentro del equipo de TI.' },
    { key: 'type', label: 'Tipo de incidencia', type: FieldType.SELECT, options: TYPE_OPTIONS },
    { key: 'category', label: 'Categoría', type: FieldType.SELECT, options: CATEGORY_OPTIONS },
    { key: 'priority', label: 'Urgencia', type: FieldType.SELECT, options: PRIORITY_OPTIONS },
    { key: 'description', label: 'Descripción', type: FieldType.EDITOR, rows: 8 },
  ],
});

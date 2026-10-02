import * as z from 'zod';
import { FieldType, type IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import {
  VALIDATION_ERRORS as V,
  validationMessage as msg,
} from '../../core/validation/validation-errors';

/**
 * Galería de la guía de estilos: UN campo de cada tipo de control que sabe pintar
 * `app-dynamic-field`, con su schema Zod. Sirve para ver, en un solo lugar, cómo se comportan la
 * etiqueta («*» con tooltip / «(Opcional)»), el contador «n / máx», el hint, el error y el estado
 * deshabilitado de cada control. No se guarda nada: la guía solo valida.
 */
const OPTIONAL_DATE = z.date().nullable();

export const FieldGallerySchema = z.object({
  // Texto
  name: z
    .string()
    .trim()
    .min(3, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El nombre', min: 3 }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El nombre', max: 40 }) }),
  email: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).max(60),
  website: z.string().max(80).default(''),
  password: z
    .string()
    .min(8, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La contraseña', min: 8 }) })
    .max(64),
  phone: z.string().nullable(),
  serial: z.string().max(8, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El serial', max: 8 }) }).default(''),
  bio: z.string().max(200, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La biografía', max: 200 }) }).default(''),
  notes: z.string().max(2000).default(''),
  // Números
  quantity: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(1, { error: msg(V.GENERIC.MIN_VALUE, { min: 1 }) })
    .max(50, { error: msg(V.GENERIC.MAX_VALUE, { max: 50 }) }),
  ratio: z.number().min(0).max(100).nullable(),
  // CURRENCY es un <input> de texto («Q» + hasta 2 decimales): su modelo es un string.
  budget: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, { error: 'Ingresa un monto válido (ej. 1250.50)' }).default(''),
  rating: z.number().nullable(),
  volume: z.number().min(0).max(100),
  // Fechas
  startDate: OPTIONAL_DATE,
  startTime: OPTIONAL_DATE,
  meeting: OPTIONAL_DATE,
  period: z.array(OPTIONAL_DATE).length(2).nullable(),
  // Opciones
  category: z.string({ error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una categoría' }) }).min(1),
  country: z.string().nullable(),
  tags: z.array(z.string()).max(3),
  assignee: z.string().max(40).default(''),
  plan: z.string().nullable(),
  urgency: z.string().nullable(),
  moment: z.string().nullable(),
  // Booleanos
  terms: z.literal(true, { error: 'Debes aceptar los términos para continuar' }),
  notify: z.boolean(),
  compact: z.boolean(),
  // Archivos y color
  brand: z.string().nullable(),
  attachment: z.instanceof(File).nullable(),
  avatar: z.string().nullable(),
});

const CATEGORY_OPTIONS: IFieldOption[] = [
  { value: 'bug', label: 'Error' },
  { value: 'feature', label: 'Funcionalidad' },
  { value: 'support', label: 'Soporte' },
];

/** Más de 10 opciones: el SELECT se pinta como autocomplete (se escribe para filtrar). */
const COUNTRY_OPTIONS: IFieldOption[] = [
  'Argentina',
  'Bolivia',
  'Brasil',
  'Chile',
  'Colombia',
  'Costa Rica',
  'Ecuador',
  'El Salvador',
  'España',
  'Guatemala',
  'Honduras',
  'México',
  'Nicaragua',
  'Panamá',
  'Paraguay',
  'Perú',
  'Uruguay',
  'Venezuela',
].map((label) => ({ value: label.toLowerCase(), label }));

const TAG_OPTIONS: IFieldOption[] = ['frontend', 'backend', 'diseño', 'infraestructura', 'datos'].map(
  (label) => ({ value: label, label }),
);

const PLAN_OPTIONS: IFieldOption[] = [
  { value: 'free', label: 'Gratis' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Equipo' },
];

const URGENCY_OPTIONS: IFieldOption[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const MOMENT_OPTIONS: IFieldOption[] = [
  { value: 'morning', label: 'Mañana', icon: 'pi pi-sun' },
  { value: 'afternoon', label: 'Tarde', icon: 'pi pi-cloud' },
  { value: 'night', label: 'Noche', icon: 'pi pi-moon' },
];

export const FIELD_GALLERY_FORM = defineForm({
  name: 'FIELD_GALLERY_FORM',
  schema: FieldGallerySchema,
  layout: 'sections',
  sections: [
    {
      key: 'text',
      label: 'Texto',
      fieldKeys: ['name', 'email', 'website', 'password', 'phone', 'serial', 'bio', 'notes'],
    },
    { key: 'numbers', label: 'Números', fieldKeys: ['quantity', 'rating', 'ratio', 'budget', 'volume'] },
    { key: 'dates', label: 'Fechas', fieldKeys: ['startDate', 'startTime', 'meeting', 'period'] },
    {
      key: 'options',
      label: 'Opciones',
      fieldKeys: ['category', 'country', 'tags', 'assignee', 'plan', 'moment', 'urgency'],
    },
    { key: 'booleans', label: 'Sí / No', fieldKeys: ['terms', 'notify', 'compact'] },
    { key: 'files', label: 'Archivos y color', fieldKeys: ['brand', 'attachment', 'avatar'] },
  ],
  fields: [
    // ── Texto ─────────────────────────────────────────────────────────────────────────────────
    {
      key: 'name',
      label: 'Nombre',
      type: FieldType.TEXT,
      placeholder: 'Ana Pérez',
      hint: 'El contador de la derecha limita lo que puedes escribir',
    },
    { key: 'email', label: 'Correo', type: FieldType.EMAIL, placeholder: 'ana@empresa.com', autocomplete: 'email' },
    { key: 'website', label: 'Sitio web', type: FieldType.URL },
    { key: 'password', label: 'Contraseña', type: FieldType.PASSWORD, autocomplete: 'new-password' },
    { key: 'phone', label: 'Teléfono', type: FieldType.PHONE },
    {
      key: 'serial',
      label: 'Serial',
      type: FieldType.TEXT_NUMBER,
      hint: 'Solo dígitos; conserva los ceros a la izquierda',
    },
    { key: 'bio', label: 'Biografía', type: FieldType.TEXTAREA, rows: 3, fullWidth: true },
    { key: 'notes', label: 'Notas (texto enriquecido)', type: FieldType.EDITOR, rows: 5, fullWidth: true, hint: 'Valor HTML; el backend lo sanea (solo formato seguro).' },
    // ── Números ───────────────────────────────────────────────────────────────────────────────
    { key: 'quantity', label: 'Cantidad', type: FieldType.INTEGER, hint: 'Entero de 1 a 50 (los límites salen del schema)' },
    { key: 'rating', label: 'Valoración (número libre)', type: FieldType.NUMBER },
    { key: 'ratio', label: 'Porcentaje', type: FieldType.DECIMAL },
    { key: 'budget', label: 'Presupuesto', type: FieldType.CURRENCY },
    { key: 'volume', label: 'Volumen', type: FieldType.SLIDER, step: 5 },
    // ── Fechas ────────────────────────────────────────────────────────────────────────────────
    { key: 'startDate', label: 'Fecha de inicio', type: FieldType.DATE },
    { key: 'startTime', label: 'Hora', type: FieldType.TIME },
    { key: 'meeting', label: 'Reunión', type: FieldType.DATETIME },
    { key: 'period', label: 'Periodo', type: FieldType.DATE_RANGE },
    // ── Opciones ──────────────────────────────────────────────────────────────────────────────
    { key: 'category', label: 'Categoría', type: FieldType.SELECT, options: CATEGORY_OPTIONS },
    {
      key: 'country',
      label: 'País',
      type: FieldType.SELECT,
      options: COUNTRY_OPTIONS,
      hint: 'Con más de 5 opciones se escribe para filtrar',
    },
    { key: 'tags', label: 'Etiquetas', type: FieldType.MULTISELECT, options: TAG_OPTIONS },
    { key: 'assignee', label: 'Responsable', type: FieldType.AUTOCOMPLETE, options: [{ value: 'ana', label: 'Ana' }, { value: 'luis', label: 'Luis' }] },
    { key: 'plan', label: 'Plan', type: FieldType.RADIO, options: PLAN_OPTIONS },
    {
      key: 'urgency',
      label: 'Urgencia (estrellas)',
      type: FieldType.RATING,
      options: URGENCY_OPTIONS,
      hint: 'La escala son las opciones: la primera es 1 estrella. El texto acompaña siempre.',
    },
    { key: 'moment', label: 'Momento', type: FieldType.RADIO_BUTTON, options: MOMENT_OPTIONS, fullWidth: true },
    // ── Sí / No ───────────────────────────────────────────────────────────────────────────────
    {
      key: 'terms',
      label: 'Términos y condiciones',
      type: FieldType.CHECKBOX,
      hint: 'Acepto el tratamiento de mis datos',
      fullWidth: true,
    },
    {
      key: 'notify',
      label: 'Avisos',
      type: FieldType.TOGGLE,
      toggleLabels: { on: 'Sí, avisarme', off: 'No avisarme' },
      fullWidth: true,
    },
    { key: 'compact', label: 'Vista compacta', type: FieldType.TOGGLE_BUTTON, toggleLabels: { on: 'Activada', off: 'Desactivada' } },
    // ── Archivos y color ──────────────────────────────────────────────────────────────────────
    { key: 'brand', label: 'Color de marca', type: FieldType.COLOR },
    { key: 'attachment', label: 'Adjunto', type: FieldType.FILE, accept: '.pdf,.png,.jpg', fullWidth: true },
    { key: 'avatar', label: 'Avatar', type: FieldType.IMAGE_UPLOAD, fullWidth: true },
  ],
});

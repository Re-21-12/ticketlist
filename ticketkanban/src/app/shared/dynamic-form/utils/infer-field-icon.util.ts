import { FieldType, type IFieldConfig } from '../field-config.interface';

/** Reglas por nombre de campo (`key`), de más a menos específicas — la primera que calza gana. */
const KEY_RULES: readonly (readonly [RegExp, string])[] = [
  [/password|contrasena|pin$/i, 'pi pi-lock'],
  [/email|correo|mail/i, 'pi pi-envelope'],
  [/phone|telefono|celular/i, 'pi pi-phone'],
  [/ipaddress|^ip$/i, 'pi pi-globe'],
  [/city|country|ciudad|pais|region/i, 'pi pi-map-marker'],
  [/currency|moneda/i, 'pi pi-money-bill'],
  [/institution|institucion|bank|banco/i, 'pi pi-building'],
  [/amount|balance|monto|saldo|cost|price|precio|payment|rate|interest/i, 'pi pi-dollar'],
  [/estimate|hours|horas|duration|duracion/i, 'pi pi-clock'],
  [/year|month|anio|mes$|date|fecha|due|cutoff|createdat|startdate|enddate/i, 'pi pi-calendar'],
  [/recurrence|frequency|interval|schedule|cron/i, 'pi pi-sync'],
  [/note|reason|description|message|summary|comment|motivo|observ/i, 'pi pi-align-left'],
  [/role|rol$|subject|permission|permiso|effect|condition|action|scope/i, 'pi pi-shield'],
  [/assignee|owner|user|usuario|actor|recipient|alternante|titular/i, 'pi pi-user'],
  [/route|url|link/i, 'pi pi-link'],
  [/icon/i, 'pi pi-image'],
  [/order|position|priority|prioridad/i, 'pi pi-sort-amount-down'],
  [/active|enabled|notify|optional|paid|autopay/i, 'pi pi-bell'],
  [/status|estado/i, 'pi pi-flag'],
  [/type|tipo|kind|category|categoria|context|event|group|label|key|name|nombre|value|code|title/i, 'pi pi-tag'],
];

/** Respaldo por tipo de control cuando el `key` no dice nada. */
const TYPE_ICON: Readonly<Partial<Record<string, string>>> = {
  [FieldType.EMAIL]: 'pi pi-envelope',
  [FieldType.PASSWORD]: 'pi pi-lock',
  [FieldType.PHONE]: 'pi pi-phone',
  [FieldType.DATE]: 'pi pi-calendar',
  [FieldType.DATETIME]: 'pi pi-calendar',
  [FieldType.DATE_RANGE]: 'pi pi-calendar',
  [FieldType.TIME]: 'pi pi-clock',
  [FieldType.CURRENCY]: 'pi pi-dollar',
  [FieldType.DECIMAL]: 'pi pi-hashtag',
  [FieldType.INTEGER]: 'pi pi-hashtag',
  [FieldType.NUMBER]: 'pi pi-hashtag',
  [FieldType.TEXT_NUMBER]: 'pi pi-hashtag',
  [FieldType.TEXTAREA]: 'pi pi-align-left',
  [FieldType.URL]: 'pi pi-link',
  [FieldType.SELECT]: 'pi pi-list',
  [FieldType.MULTISELECT]: 'pi pi-list',
  [FieldType.AUTOCOMPLETE]: 'pi pi-search',
  [FieldType.TOGGLE]: 'pi pi-sliders-h',
  [FieldType.CHECKBOX]: 'pi pi-check-square',
  [FieldType.TEXT]: 'pi pi-pencil',
};

/** Controles que no llevan ícono dentro del campo (no son una captura con etiqueta propia). */
const NO_ICON_TYPES: ReadonlySet<string> = new Set<string>([
  FieldType.IMAGE_UPLOAD,
  FieldType.FILE,
  FieldType.COLOR,
  FieldType.SLIDER,
  FieldType.RATING,
  FieldType.EDITOR,
  FieldType.RADIO,
  FieldType.RADIO_BUTTON,
  FieldType.TOGGLE_BUTTON,
]);

/**
 * Ícono de contexto de un campo que no declara `icon` (criterio de wallet-api: «usa íconos en los
 * campos para seguir el contexto y dar mejor retroalimentación»). Primero por el nombre del campo,
 * luego por el tipo de control; un `icon` explícito siempre gana y `''` lo desactiva.
 */
export function resolveFieldIcon(field: Pick<IFieldConfig, 'key' | 'type' | 'icon'>): string {
  if (field.icon !== undefined) return field.icon;
  if (NO_ICON_TYPES.has(field.type)) return '';
  for (const [rule, icon] of KEY_RULES) if (rule.test(field.key)) return icon;
  return TYPE_ICON[field.type] ?? '';
}

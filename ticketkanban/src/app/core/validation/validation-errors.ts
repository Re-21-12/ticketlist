/**
 * ESPEJO 1:1 de ticketlistbe/src/common/codes/validation-errors.ts — mismos mensajes que valida
 * el backend (y que documenta ticketlistbe/docs/standard/error-catalog.md §4). Mantener
 * sincronizado hasta extraer el paquete compartido `@ticketit/contracts`; lo verifica
 * `validation-errors.mirror.spec.ts` (en ticketlistbe) comparando ambos archivos.
 */

export interface IValidationMessage {
  messageEs: string;
  messageEn: string;
}

export const VALIDATION_ERRORS = {
  /** Mensajes genéricos reutilizables en cualquier módulo. */
  GENERIC: {
    REQUIRED_SELECTION: {
      messageEs: 'Selecciona {field}',
      messageEn: 'Select {field}',
    },
    MIN_LENGTH: {
      messageEs: '{field} debe tener al menos {min} caracteres',
      messageEn: '{field} must have at least {min} characters',
    },
    MAX_LENGTH: {
      messageEs: '{field} no debe superar {max} caracteres',
      messageEn: '{field} must not exceed {max} characters',
    },
    IS_NUMBER: {
      messageEs: 'Ingresa un número',
      messageEn: 'Enter a number',
    },
    IS_INTEGER: {
      messageEs: 'Solo números enteros',
      messageEn: 'Whole numbers only',
    },
    MIN_VALUE: {
      messageEs: 'El valor mínimo es {min}',
      messageEn: 'The minimum value is {min}',
    },
    MAX_VALUE: {
      messageEs: 'El valor máximo es {max}',
      messageEn: 'The maximum value is {max}',
    },
    IS_EMAIL: {
      messageEs: 'Ingresa un correo válido (ej. ana@empresa.com)',
      messageEn: 'Enter a valid email (e.g. ana@company.com)',
    },
    IS_UUID: {
      messageEs: 'UUID inválido',
      messageEn: 'Invalid UUID',
    },
    IS_DATE: {
      messageEs: 'Fecha inválida',
      messageEn: 'Invalid date',
    },
  },

  /** Paginación estándar (`BasePaginationSchema`). */
  PAGINATION: {
    MIN_PAGE: {
      messageEs: 'La página mínima es {min}',
      messageEn: 'The minimum page is {min}',
    },
    MAX_TAKE: {
      messageEs: 'Máximo {max} registros por página',
      messageEn: 'At most {max} records per page',
    },
  },

  /** Reglas propias de Tickets (`modules/tickets/schemas/ticket.schema.ts`). */
  TICKET: {
    OTHER_CATEGORY_DETAIL_REQUIRED: {
      messageEs: 'Describe la categoría',
      messageEn: 'Describe the category',
    },
    RESOLUTION_REQUIRED: {
      messageEs: 'Documenta la solución para poder resolver el ticket',
      messageEn: 'Document the solution to resolve the ticket',
    },
    SURVEY_SCORE: {
      messageEs: 'Elige una calificación de 1 a 5',
      messageEn: 'Choose a rating from 1 to 5',
    },
  },

  /** Cambio de contraseña (`modules/auth/dtos/change-password.dto.ts`). */
  PASSWORD: {
    CURRENT_REQUIRED: {
      messageEs: 'Ingresa tu contraseña actual',
      messageEn: 'Enter your current password',
    },
    MISSING: {
      messageEs: 'Agrega: {missing}',
      messageEn: 'Add: {missing}',
    },
  },

  /** Alta de cuenta y enlaces por correo (`modules/auth/dtos/*.dto.ts`). */
  ACCOUNT: {
    TOKEN_REQUIRED: {
      messageEs: 'El enlace no es válido',
      messageEn: 'The link is not valid',
    },
    CODE_INVALID: {
      messageEs: 'Escribe el código de 6 dígitos de tu autenticador',
      messageEn: 'Enter the 6-digit code from your authenticator',
    },
  },

  /** Relaciones Titular/Alternante (`modules/relationships/schemas/relationship.schema.ts`). */
  RELATIONSHIP: {
    GRANTS_REQUIRED: {
      messageEs: 'Indica al menos un recurso a compartir',
      messageEn: 'Specify at least one resource to share',
    },
    CONSENT_REQUIRED: {
      messageEs: 'Debes aceptar el consentimiento para compartir tus datos',
      messageEn: 'You must accept the consent to share your data',
    },
  },

  /** Administración (menú, catálogos): identificadores y rutas con formato cerrado. */
  ADMIN: {
    INVALID_KEY: {
      messageEs: 'Usa solo minúsculas, números y guiones (empieza con una letra)',
      messageEn: 'Use only lowercase letters, numbers and hyphens (start with a letter)',
    },
    INVALID_ROUTE: {
      messageEs: 'Escribe una ruta interna que empiece con una sola barra, por ejemplo /tickets',
      messageEn: 'Enter an internal path that starts with a single slash, for example /tickets',
    },
    INVALID_ICON: {
      messageEs: 'El ícono debe tener la forma pi-nombre',
      messageEn: 'The icon must look like pi-name',
    },
    INVALID_CODE: {
      messageEs: 'Usa solo mayúsculas, números y guion bajo (empieza con una letra)',
      messageEn: 'Use only uppercase letters, numbers and underscores (start with a letter)',
    },
  },

  /** Métricas del servicio (`modules/metrics/metrics.schema.ts`). */
  METRICS: {
    PERIOD_ORDER: {
      messageEs: 'La fecha final no puede ser anterior a la inicial',
      messageEn: 'The end date cannot be before the start date',
    },
    PERIOD_TOO_LONG: {
      messageEs: 'El período no puede superar {max} días',
      messageEn: 'The period cannot exceed {max} days',
    },
  },
} as const satisfies Record<string, Record<string, IValidationMessage>>;

/** Mensaje en español con los `{tokens}` reemplazados — lo que va en `{ error }` de Zod. */
export function validationMessage(
  entry: IValidationMessage,
  params: Record<string, string | number> = {},
  locale: 'es' | 'en' = 'es',
): string {
  const template = locale === 'es' ? entry.messageEs : entry.messageEn;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

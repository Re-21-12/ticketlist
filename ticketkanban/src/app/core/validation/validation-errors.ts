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

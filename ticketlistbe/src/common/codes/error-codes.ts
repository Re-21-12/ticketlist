import { HttpStatus } from '@nestjs/common';
import type { TCodeModuleRegistry } from '../../core/interfaces/Icustom-code.interface.js';

/*
 * Catálogo central de errores (mismo formato que wallet-api):
 *   <Capa><Módulo>-E<###>
 *   Capa:   R = Repositorio / BD (datos) · S = Servicio (negocio) · C = Controlador / DTO (request)
 *   Módulo: 3 letras (TCK = tickets, VAL = validación, AUT = auth, DB = base de datos)
 *   Ej.: RTCK-E001 → Repositorio · Tickets · 001 (no encontrado)
 *   Excepciones al formato: `SYS-E999` (no mapeado) y `NEST-E<status>` (HttpException de Nest
 *   sin código de negocio, se genera en el filtro).
 *
 * DOCUMENTACIÓN: cada código de este archivo DEBE estar en docs/standard/error-catalog.md — lo
 * verifica `error-catalog.docs.spec.ts` (el test falla si agregas un código sin documentarlo).
 */
export const ERROR_CODES = {
  // ── Sistema ──────────────────────────────────────────────────────────────
  SYS: {
    INTERNAL: {
      code: 'SYS-E999',
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      messageEn: 'Internal server error',
      messageEs: 'Error interno del servidor',
    },
  },
  // ── Base de datos (R) — clave = SQLSTATE de PostgreSQL (driverError.code) ─
  // Se activa al conectar un ORM; el repositorio en memoria no los produce.
  DB: {
    '23502': {
      code: 'RDB-E23502',
      httpStatus: HttpStatus.BAD_REQUEST,
      messageEn: 'Missing required fields restricted by the database',
      messageEs: 'Faltan campos obligatorios',
    },
    '23503': {
      code: 'RDB-E23503',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'Foreign key violation',
      messageEs: 'El campo no contiene una referencia válida',
    },
    '23505': {
      code: 'RDB-E23505',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'A record with those unique values already exists',
      messageEs: 'Ya existe un registro con esos datos únicos',
    },
    '23514': {
      code: 'RDB-E23514',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'Data does not satisfy database check constraints',
      messageEs: 'Los datos no cumplen las restricciones de la base de datos',
    },
    '22001': {
      code: 'RDB-E22001',
      httpStatus: HttpStatus.BAD_REQUEST,
      messageEn: 'The value exceeds the maximum length allowed for this field',
      messageEs: 'El valor supera la longitud máxima permitida para ese campo',
    },
  },
  // ── Validación de DTOs (C) — detalle por campo en `issues`, mensajes en validation-errors.ts ─
  VAL: {
    INVALID_PAYLOAD: {
      code: 'CVAL-E001',
      httpStatus: HttpStatus.BAD_REQUEST,
      messageEn: 'Invalid data',
      messageEs: 'Datos inválidos',
    },
  },
  // ── Autenticación / autorización (S) — sesión, CSRF, CaslGuard (tipo), assertCan (registro) ─
  AUT: {
    FORBIDDEN: {
      code: 'SAUT-E001',
      httpStatus: HttpStatus.FORBIDDEN,
      messageEn: "You don't have enough permissions for this",
      messageEs: 'No tienes permisos suficientes para esto',
    },
    UNAUTHENTICATED: {
      code: 'SAUT-E002',
      httpStatus: HttpStatus.UNAUTHORIZED,
      messageEn: 'You need to sign in',
      messageEs: 'Necesitas iniciar sesión',
    },
    CSRF_MISMATCH: {
      code: 'SAUT-E003',
      httpStatus: HttpStatus.FORBIDDEN,
      messageEn: 'Invalid or missing CSRF token',
      messageEs: 'Token CSRF inválido o ausente',
    },
    INVALID_CREDENTIALS: {
      code: 'SAUT-E004',
      httpStatus: HttpStatus.UNAUTHORIZED,
      messageEn: 'Invalid credentials',
      messageEs: 'Credenciales inválidas',
    },
    SESSION_EXPIRED: {
      code: 'SAUT-E005',
      httpStatus: HttpStatus.UNAUTHORIZED,
      messageEn: 'Your session expired, sign in again',
      messageEs: 'Tu sesión expiró, vuelve a iniciar sesión',
    },
    CURRENT_PASSWORD_INVALID: {
      code: 'SAUT-E006',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The current password is not correct',
      messageEs: 'La contraseña actual no es correcta',
    },
    PASSWORD_UNCHANGED: {
      code: 'SAUT-E007',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The new password must be different from the current one',
      messageEs: 'La nueva contraseña debe ser distinta de la actual',
    },
    EMAIL_NOT_VERIFIED: {
      code: 'SAUT-E008',
      httpStatus: HttpStatus.FORBIDDEN,
      messageEn: 'Verify your email before signing in',
      messageEs: 'Verifica tu correo antes de iniciar sesión',
    },
    TOKEN_INVALID: {
      code: 'SAUT-E009',
      httpStatus: HttpStatus.BAD_REQUEST,
      messageEn: 'The link is invalid or has expired',
      messageEs: 'El enlace no es válido o ya venció',
    },
    RECOVERY_INVALID: {
      code: 'SAUT-E010',
      httpStatus: HttpStatus.UNAUTHORIZED,
      messageEn: 'The verification data is not correct',
      messageEs: 'Los datos de verificación no son correctos',
    },
    TOTP_CODE_INVALID: {
      code: 'SAUT-E011',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The authenticator code is not correct',
      messageEs: 'El código del autenticador no es correcto',
    },
    TOTP_NOT_PENDING: {
      code: 'SAUT-E012',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'There is no authenticator setup in progress',
      messageEs: 'No hay una configuración del autenticador en curso',
    },
    ACCOUNT_LOCKED: {
      code: 'SAUT-E014',
      httpStatus: HttpStatus.LOCKED,
      messageEn: 'Your account is locked after too many failed attempts. Contact an administrator to unlock it',
      messageEs: 'Tu cuenta está bloqueada por demasiados intentos fallidos. Comunícate con un administrador para desbloquearla',
    },
    TOTP_ALREADY_ENABLED: {
      code: 'SAUT-E013',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'The authenticator is already enabled',
      messageEs: 'El autenticador ya está activado',
    },
  },
  // ── Usuarios (S) ──────────────────────────────────────────────────────────
  USR: {
    EMAIL_TAKEN: {
      code: 'SUSR-E001',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'An account with that email already exists',
      messageEs: 'Ya existe una cuenta con ese correo',
    },
    NOT_FOUND: {
      code: 'SUSR-E002',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'User not found',
      messageEs: 'Usuario no encontrado',
    },
    CANNOT_CHANGE_SELF: {
      code: 'SUSR-E003',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'You cannot change your own role or disable your own account',
      messageEs: 'No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta',
    },
    LAST_ADMIN: {
      code: 'SUSR-E004',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'At least one active administrator must remain',
      messageEs: 'Debe quedar al menos un administrador activo',
    },
  },
  // ── Sesiones del usuario (R/S) ────────────────────────────────────────────
  SES: {
    NOT_FOUND: {
      code: 'RSES-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Session not found',
      messageEs: 'Sesión no encontrada',
    },
    IS_CURRENT: {
      code: 'SSES-E001',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'To end the current session use sign out',
      messageEs: 'Para cerrar la sesión actual usa «Cerrar sesión»',
    },
  },
  // ── Rate limiting (S) — 429, `Retry-After` y `context.retryAfterSeconds` ──
  RATE: {
    TOO_MANY_REQUESTS: {
      code: 'SRTL-E001',
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      messageEn: 'Too many requests, try again later',
      messageEs: 'Demasiadas solicitudes, intenta de nuevo más tarde',
    },
  },
  // ── Concurrencia optimista (S) — If-Match (RFC 9110 §13.1.1) ─────────────
  CONC: {
    VERSION_MISMATCH: {
      code: 'SCONC-E001',
      httpStatus: HttpStatus.PRECONDITION_FAILED,
      messageEn: 'The resource was modified by someone else; reload and try again',
      messageEs: 'Otra persona modificó este recurso; recarga e intenta de nuevo',
    },
  },
  // ── Relaciones Titular/Alternante (R/S) ─────────────────────────────────
  REL: {
    NOT_FOUND: {
      code: 'RREL-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Relationship not found',
      messageEs: 'Relación no encontrada',
    },
    SELF_RELATIONSHIP: {
      code: 'SREL-E001',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'You cannot share your data with yourself',
      messageEs: 'No puedes compartir tus datos contigo mismo',
    },
    ALTERNANTE_NOT_FOUND: {
      code: 'SREL-E002',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The alternate user does not exist',
      messageEs: 'La persona alternante no existe',
    },
    ALREADY_ACTIVE: {
      code: 'SREL-E003',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'There is already an active relationship with that user',
      messageEs: 'Ya existe una relación activa con esa persona',
    },
    NOT_TITULAR: {
      code: 'SREL-E004',
      httpStatus: HttpStatus.FORBIDDEN,
      messageEn: 'Only the owner (titular) can change the relationship rules',
      messageEs: 'Solo el titular puede cambiar las reglas de la relación',
    },
  },
  // ── Menú administrable (R) ───────────────────────────────────────────────
  MNU: {
    NOT_FOUND: {
      code: 'RMNU-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Menu item not found',
      messageEs: 'Ítem de menú no encontrado',
    },
    DUPLICATED_KEY: {
      code: 'RMNU-E002',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'A menu item with that key already exists',
      messageEs: 'Ya existe un ítem de menú con esa clave',
    },
    ALREADY_DELETED: {
      code: 'RMNU-E003',
      httpStatus: HttpStatus.GONE,
      messageEn: 'Menu item already deleted',
      messageEs: 'El ítem de menú ya fue eliminado',
    },
  },
  // ── Catálogos (R) ─────────────────────────────────────────────────────────
  CAT: {
    NOT_FOUND: {
      code: 'RCAT-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Catalog not found',
      messageEs: 'Catálogo no encontrado',
    },
    ITEM_NOT_FOUND: {
      code: 'RCAT-E002',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Catalog item not found',
      messageEs: 'Elemento del catálogo no encontrado',
    },
    DUPLICATED_CODE: {
      code: 'RCAT-E003',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'That code already exists in this catalog',
      messageEs: 'Ese código ya existe en este catálogo',
    },
    SYSTEM_ITEM: {
      code: 'RCAT-E004',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'System items cannot be deleted or have their code changed',
      messageEs: 'Los elementos del sistema no se eliminan ni cambian de código',
    },
    DUPLICATED_KEY: {
      code: 'RCAT-E005',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'A catalog with that key already exists',
      messageEs: 'Ya existe un catálogo con esa clave',
    },
  },
  // ── Auditoría (S) ─────────────────────────────────────────────────────────
  AUD: {
    NOT_FOUND: {
      code: 'SAUD-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Audit entry not found',
      messageEs: 'Entrada de auditoría no encontrada',
    },
  },
  // ── Permisos por rol (R) ─────────────────────────────────────────────────
  RPM: {
    NOT_FOUND: {
      code: 'RRPM-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Role permission not found',
      messageEs: 'Permiso de rol no encontrado',
    },
    DUPLICATED: {
      code: 'RRPM-E002',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'That role already has that permission',
      messageEs: 'Ese rol ya tiene ese permiso',
    },
  },
  // ── Notificaciones (R) ───────────────────────────────────────────────────
  NTF: {
    NOT_FOUND: {
      code: 'RNTF-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Notification not found',
      messageEs: 'Notificación no encontrada',
    },
  },
  // ── Tickets (R) ──────────────────────────────────────────────────────────
  TCK: {
    NOT_FOUND: {
      code: 'RTCK-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Ticket not found',
      messageEs: 'Ticket no encontrado',
    },
    ALREADY_DELETED: {
      code: 'RTCK-E002',
      httpStatus: HttpStatus.GONE,
      messageEn: 'Ticket already deleted',
      messageEs: 'El ticket ya fue eliminado',
    },
    NOT_DELETED: {
      code: 'RTCK-E003',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'Ticket is not deleted',
      messageEs: 'El ticket no está eliminado',
    },
    TRANSITION_NOT_ALLOWED: {
      code: 'STCK-E001',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'The ticket cannot move to that status',
      messageEs: 'El ticket no puede pasar a ese estado',
    },
    COMMENTS_IMMUTABLE: {
      code: 'STCK-E002',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'Previous comments cannot be modified',
      messageEs: 'Los comentarios previos no pueden modificarse',
    },
    CLOSED_NO_COMMENTS: {
      code: 'STCK-E003',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'The ticket is closed: reopen it to comment',
      messageEs: 'El ticket está cerrado: reábrelo para comentar',
    },
    REOPEN_WINDOW_EXPIRED: {
      code: 'STCK-E004',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'The reopening window has expired; open a new ticket',
      messageEs: 'Venció el plazo para reabrir el ticket; registra uno nuevo',
    },
    ASSIGNMENT_FORBIDDEN: {
      code: 'STCK-E005',
      httpStatus: HttpStatus.FORBIDDEN,
      messageEn: 'You can only take tickets that have no assignee',
      messageEs: 'Solo puedes tomar tickets que no tengan responsable',
    },
    DEPARTMENT_INVALID: {
      code: 'STCK-E007',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'That department does not exist or is not available',
      messageEs: 'Ese departamento no existe o no está disponible',
    },
    ASSIGNEE_NOT_FOUND: {
      code: 'STCK-E006',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'That person cannot be assigned tickets',
      messageEs: 'Esa persona no puede recibir tickets',
    },
  },
  // ── Adjuntos de ticket (R/S) ──────────────────────────────────────────────
  ATT: {
    TOO_LARGE: {
      code: 'SATT-E001',
      httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
      messageEn: 'The file is too large',
      messageEs: 'El archivo supera el tamaño permitido',
    },
    TYPE_NOT_ALLOWED: {
      code: 'SATT-E002',
      httpStatus: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      messageEn: 'That file type is not allowed',
      messageEs: 'Ese tipo de archivo no está permitido',
    },
    NOT_FOUND: {
      code: 'RATT-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Attachment not found',
      messageEs: 'Adjunto no encontrado',
    },
    FILE_REQUIRED: {
      code: 'SATT-E003',
      httpStatus: HttpStatus.BAD_REQUEST,
      messageEn: 'Attach a file',
      messageEs: 'Adjunta un archivo',
    },
    VIDEO_TOO_LONG: {
      code: 'SATT-E004',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The video is longer than 5 minutes',
      messageEs: 'El video dura más de 5 minutos',
    },
    VIDEO_DURATION_UNKNOWN: {
      code: 'SATT-E005',
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      messageEn: 'The video duration could not be verified',
      messageEs: 'No se pudo comprobar la duración del video',
    },
    STORAGE_UNAVAILABLE: {
      code: 'SATT-E006',
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
      messageEn: 'File storage is not available right now',
      messageEs: 'El almacenamiento de archivos no está disponible en este momento',
    },
  },
  // ── Tareas programadas (R) ────────────────────────────────────────────────
  JOB: {
    NOT_FOUND: {
      code: 'RJOB-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'Scheduled job not found',
      messageEs: 'Tarea programada no encontrada',
    },
  },
  // ── Encuesta de satisfacción (S) ──────────────────────────────────────────
  SRV: {
    NOT_AVAILABLE: {
      code: 'SSRV-E001',
      httpStatus: HttpStatus.NOT_FOUND,
      messageEn: 'There is no survey available for this ticket',
      messageEs: 'No hay encuesta disponible para este ticket',
    },
    ALREADY_ANSWERED: {
      code: 'SSRV-E002',
      httpStatus: HttpStatus.CONFLICT,
      messageEn: 'The survey was already answered',
      messageEs: 'La encuesta ya fue respondida',
    },
    EXPIRED: {
      code: 'SSRV-E003',
      httpStatus: HttpStatus.GONE,
      messageEn: 'The survey expired',
      messageEs: 'La encuesta venció',
    },
  },
} as const satisfies TCodeModuleRegistry;

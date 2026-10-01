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
  },
} as const satisfies TCodeModuleRegistry;

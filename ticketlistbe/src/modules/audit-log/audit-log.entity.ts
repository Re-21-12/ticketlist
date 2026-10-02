export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SIGN_IN', 'SIGN_OUT'] as const;
export type TAuditAction = (typeof AUDIT_ACTIONS)[number];

/** SUCCESS: lo hizo · DENIED: 401/403/429 (no tenía permiso o lo frenó el límite) · FAILED: validación, conflicto o error. */
export const AUDIT_OUTCOMES = ['SUCCESS', 'DENIED', 'FAILED'] as const;
export type TAuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/**
 * Una línea del registro de auditoría: QUIÉN hizo QUÉ, sobre QUÉ y con qué resultado. Es inmutable
 * (no existe update ni delete). Nunca guarda valores del body (pueden traer contraseñas o datos
 * personales): solo los NOMBRES de los campos que se intentó cambiar.
 */
export interface IAuditLog {
  uuid: string;
  at: Date;
  action: TAuditAction;
  /** Recurso afectado: primer segmento de la ruta (`tickets`, `users`, `role-permissions`, `auth`…). */
  subject: string;
  /** Plantilla de la ruta (`/api/users/:uuid/role`), nunca la URL con datos. */
  route: string;
  method: string;
  /** `uuid` del recurso afectado cuando la ruta lo trae. */
  resourceUuid: string | null;
  status: number;
  outcome: TAuditOutcome;
  actorUuid: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  ip: string;
  userAgent: string;
  requestId: string | null;
  changedFields: string[];
}

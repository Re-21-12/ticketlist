// Espejo de ticketkanban/src/app/core/casl/ability.enum.ts.
export enum EAbility {
  MANAGE = 'manage',
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore',
}

export enum EUserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  /** Supervisor de soporte: ve las métricas del equipo, asigna y reasigna. */
  SUPERVISOR = 'SUPERVISOR',
  /** Auditor: solo lectura de tickets, métricas y auditoría; no modifica nada. */
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

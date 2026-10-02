// Espejo de ticketlistbe/src/modules/auth/casl/ability.enum.ts — mantener sincronizado hasta que
// exista el paquete compartido de contratos (mismo criterio que wallet-api).
export enum EAbility {
  /** Cualquier acción, incluido restaurar. */
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
  /** Supervisor de soporte: métricas del equipo, asigna y reasigna. */
  SUPERVISOR = 'SUPERVISOR',
  /** Auditor: solo lectura de tickets, métricas y auditoría. */
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

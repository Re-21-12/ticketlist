import { EAbility, EUserRole } from '../../auth/casl/ability.enum.js';
import type { RolePermissionEntity } from './role-permission.entity.js';

type TSeed = Pick<RolePermissionEntity, 'role' | 'subject' | 'action' | 'condition'>;

/** Permisos iniciales (equivale al seed `role_permissions` de wallet-api). */
const SEED: TSeed[] = [
  { role: EUserRole.ADMIN, subject: 'all', action: EAbility.MANAGE, condition: 'NONE' },
  // Agente N1: ve todos los tickets, crea y edita los que tiene asignados; sus propias métricas.
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.CREATE, condition: 'NONE' },
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.UPDATE, condition: 'ASSIGNED_TO_ME' },
  { role: EUserRole.AGENT, subject: 'MyMetric', action: EAbility.READ, condition: 'NONE' },
  // Supervisor: todo el flujo de tickets (asigna, reasigna, escala), métricas del equipo y lista de personas.
  { role: EUserRole.SUPERVISOR, subject: 'Ticket', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.SUPERVISOR, subject: 'Ticket', action: EAbility.CREATE, condition: 'NONE' },
  { role: EUserRole.SUPERVISOR, subject: 'Ticket', action: EAbility.UPDATE, condition: 'NONE' },
  { role: EUserRole.SUPERVISOR, subject: 'Metric', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.SUPERVISOR, subject: 'MyMetric', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.SUPERVISOR, subject: 'User', action: EAbility.READ, condition: 'NONE' },
  // Auditor: solo lectura de tickets, métricas y auditoría. No modifica nada.
  { role: EUserRole.AUDITOR, subject: 'Ticket', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.AUDITOR, subject: 'Metric', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.AUDITOR, subject: 'AuditLog', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.AUDITOR, subject: 'User', action: EAbility.READ, condition: 'NONE' },
  // Cliente (rol VIEWER): registra solicitudes; ve y gestiona las SUYAS (titular) y lo que le compartan.
  { role: EUserRole.VIEWER, subject: 'Ticket', action: EAbility.CREATE, condition: 'NONE' },
];

const at = new Date('2026-09-01T00:00:00Z');

export const ROLE_PERMISSIONS_SEED: RolePermissionEntity[] = SEED.map((row, index) => ({
  ...row,
  id: 0,
  uuid: `7a000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  createdAt: at,
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  isDeleted: false,
  restoredAt: null,
  restoredBy: null,
}));

import { EAbility, EUserRole } from '../../auth/casl/ability.enum.js';
import type { RolePermissionEntity } from './role-permission.entity.js';

type TSeed = Pick<RolePermissionEntity, 'role' | 'subject' | 'action' | 'condition'>;

/** Permisos iniciales (equivale al seed `role_permissions` de wallet-api). */
const SEED: TSeed[] = [
  { role: EUserRole.ADMIN, subject: 'all', action: EAbility.MANAGE, condition: 'NONE' },
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.READ, condition: 'NONE' },
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.CREATE, condition: 'NONE' },
  { role: EUserRole.AGENT, subject: 'Ticket', action: EAbility.UPDATE, condition: 'ASSIGNED_TO_ME' },
  { role: EUserRole.VIEWER, subject: 'Ticket', action: EAbility.READ, condition: 'NONE' },
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

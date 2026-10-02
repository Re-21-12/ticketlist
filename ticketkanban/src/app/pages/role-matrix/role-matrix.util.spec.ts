import { EAbility, EUserRole } from '../../core/casl/ability.enum';
import type { TConditionPreset } from '../../core/casl/casl-labels.constants';
import type { TSubjects } from '../../core/casl/casl.types';
import type { TRolePermission } from '../role-permissions/role-permission.types';
import { cellFor, hasAnyAccess } from './role-matrix.util';

let counter = 0;
const rule = (
  role: EUserRole,
  subject: TSubjects,
  action: EAbility,
  condition: TConditionPreset = 'NONE',
): TRolePermission => ({
  uuid: `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  role,
  subject,
  action,
  condition,
  createdAt: '2026-09-01T00:00:00Z',
});

describe('cellFor (matriz de roles)', () => {
  it('permiso directo → on, con sus reglas', () => {
    const rules = [rule(EUserRole.AGENT, 'Ticket', EAbility.READ)];
    const cell = cellFor(rules, EUserRole.AGENT, 'Ticket', EAbility.READ);
    expect(cell.state).toBe('on');
    expect(cell.rules).toHaveLength(1);
    expect(cell.conditional).toBe(false);
  });

  it('sin regla → off', () => {
    expect(cellFor([], EUserRole.VIEWER, 'Ticket', EAbility.UPDATE).state).toBe('off');
  });

  it('«manage all» concede todo como heredado (no se apaga desde la matriz)', () => {
    const rules = [rule(EUserRole.ADMIN, 'all', EAbility.MANAGE)];
    for (const action of [EAbility.CREATE, EAbility.READ, EAbility.DELETE, EAbility.RESTORE]) {
      expect(cellFor(rules, EUserRole.ADMIN, 'Catalog', action).state).toBe('inherited');
    }
  });

  it('«manage» sobre un recurso solo hereda en ese recurso', () => {
    const rules = [rule(EUserRole.AGENT, 'Ticket', EAbility.MANAGE)];
    expect(cellFor(rules, EUserRole.AGENT, 'Ticket', EAbility.DELETE).state).toBe('inherited');
    expect(cellFor(rules, EUserRole.AGENT, 'User', EAbility.DELETE).state).toBe('off');
  });

  it('un permiso directo gana sobre el heredado (se puede quitar)', () => {
    const rules = [rule(EUserRole.ADMIN, 'all', EAbility.MANAGE), rule(EUserRole.ADMIN, 'Ticket', EAbility.READ)];
    expect(cellFor(rules, EUserRole.ADMIN, 'Ticket', EAbility.READ).state).toBe('on');
  });

  it('con condición es parcial; con una variante sin condición ya no lo es', () => {
    const partial = [rule(EUserRole.AGENT, 'Ticket', EAbility.UPDATE, 'ASSIGNED_TO_ME')];
    expect(cellFor(partial, EUserRole.AGENT, 'Ticket', EAbility.UPDATE).conditional).toBe(true);
    const full = [...partial, rule(EUserRole.AGENT, 'Ticket', EAbility.UPDATE, 'NONE')];
    expect(cellFor(full, EUserRole.AGENT, 'Ticket', EAbility.UPDATE).conditional).toBe(false);
  });

  it('no mezcla roles', () => {
    const rules = [rule(EUserRole.AGENT, 'Ticket', EAbility.CREATE)];
    expect(cellFor(rules, EUserRole.VIEWER, 'Ticket', EAbility.CREATE).state).toBe('off');
  });
});

describe('hasAnyAccess', () => {
  it('true si el rol tiene al menos una acción sobre el recurso', () => {
    const rules = [rule(EUserRole.VIEWER, 'Ticket', EAbility.READ)];
    expect(hasAnyAccess(rules, EUserRole.VIEWER, 'Ticket')).toBe(true);
    expect(hasAnyAccess(rules, EUserRole.VIEWER, 'User')).toBe(false);
  });
});

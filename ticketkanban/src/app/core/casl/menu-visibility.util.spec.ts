import type { INavItem } from '../../layouts/layout/layout.interface';
import { EUserRole } from './ability.enum';
import { isMenuItemVisible, resolveVisibleMenuItems, type ICanCheck } from './menu-visibility.util';

describe('menu-visibility.util', () => {
  const board: INavItem = { key: 'board', label: 'Tablero', route: '/tickets' };
  const ability = (result: boolean): ICanCheck => ({ can: () => result });

  it('un ítem sin subject siempre es visible', () => {
    expect(isMenuItemVisible(board, ability(false), EUserRole.VIEWER)).toBe(true);
  });

  it('un ítem con subject depende de la ability', () => {
    const item: INavItem = { ...board, subject: 'Ticket' };
    expect(isMenuItemVisible(item, ability(false), EUserRole.VIEWER)).toBe(false);
    expect(isMenuItemVisible(item, ability(true), EUserRole.VIEWER)).toBe(true);
  });

  it('usa requiredAction en vez de read cuando el ítem lo declara', () => {
    const can = vi.fn().mockReturnValue(true);
    isMenuItemVisible({ ...board, subject: 'Ticket', requiredAction: 'create' }, { can }, undefined);
    expect(can).toHaveBeenCalledWith('create', 'Ticket');
  });

  it('hiddenForRoles oculta el ítem aunque la ability lo permita', () => {
    const item: INavItem = { ...board, hiddenForRoles: [EUserRole.ADMIN] };
    expect(isMenuItemVisible(item, ability(true), EUserRole.ADMIN)).toBe(false);
    expect(isMenuItemVisible(item, ability(true), EUserRole.AGENT)).toBe(true);
  });

  it('resolveVisibleMenuItems filtra la lista completa', () => {
    const items = [board, { ...board, key: 'users', subject: 'User' as const }];
    expect(resolveVisibleMenuItems(items, ability(false), EUserRole.AGENT)).toEqual([board]);
  });
});

import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { EAbility } from '../../modules/auth/casl/ability.enum.js';
import { CaslAbilityFactory } from '../../modules/auth/casl/casl-ability.factory.js';
import { ShellResponseSchema, type TShellResponse } from './dtos/shell-response.dto.js';

/** Catálogo del menú (en wallet-api: tabla `menu_items`). QUIÉN ve cada ítem lo decide CASL en el front. */
const MENU: TShellResponse['menu'] = [
  { key: 'board', label: 'Tablero', route: '/tickets', group: 'Tickets', subject: 'Ticket' },
  { key: 'list', label: 'Listado', route: '/tickets/list', group: 'Tickets', subject: 'Ticket' },
  {
    key: 'new-ticket',
    label: 'Nuevo ticket',
    route: '/tickets/new',
    group: 'Tickets',
    subject: 'Ticket',
    requiredAction: EAbility.CREATE,
  },
  {
    key: 'sharing',
    label: 'Compartir mis tickets',
    route: '/sharing',
    group: 'Tickets',
    subject: 'Relationship',
    requiredAction: EAbility.CREATE,
  },
  // «Mi perfil» reúne información, seguridad, sesiones, notificaciones, avatar y apariencia (como wallet-api).
  { key: 'profile', label: 'Mi perfil', route: '/profile', group: 'Preferencias' },
  { key: 'appearance', label: 'Apariencia', route: '/appearance', group: 'Preferencias' },
  { key: 'style-guide', label: 'Guía de estilos', route: '/style-guide', group: 'Preferencias' },
  {
    key: 'role-permissions',
    label: 'Permisos por rol',
    route: '/role-permissions',
    group: 'Administración',
    subject: 'RolePermission',
    requiredAction: EAbility.READ,
  },
];

/**
 * BFF del shell: usuario + reglas CASL + menú en UNA respuesta con la forma exacta que necesita
 * el layout del front (en vez de /me + /permissions + /menu-items por separado).
 */
@Injectable()
export class ShellService {
  constructor(private readonly abilityFactory: CaslAbilityFactory) {}

  getShell(): TShellResponse {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN);
    return ShellResponseSchema.parse({
      user,
      abilityRules: this.abilityFactory.rulesFor(user),
      menu: MENU,
    });
  }
}

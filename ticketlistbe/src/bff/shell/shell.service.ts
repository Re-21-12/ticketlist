import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { CaslAbilityFactory } from '../../modules/auth/casl/casl-ability.factory.js';
import { MenuItemsRepository } from '../../modules/menu-items/menu-items.repository.js';
import { ShellResponseSchema, type TShellResponse } from './dtos/shell-response.dto.js';

/**
 * BFF del shell: usuario + reglas CASL + menú en UNA respuesta con la forma exacta que necesita
 * el layout del front (en vez de /me + /permissions + /menu-items por separado).
 */
@Injectable()
export class ShellService {
  constructor(
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly menuItems: MenuItemsRepository,
  ) {}

  getShell(): TShellResponse {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN);
    return ShellResponseSchema.parse({
      user,
      abilityRules: this.abilityFactory.rulesFor(user),
      // El catálogo es administrable (`/api/menu-items`); QUIÉN ve cada ítem lo decide CASL en el front.
      menu: this.menuItems.findActiveOrdered().map((item) => ({
        key: item.key,
        label: item.label,
        route: item.route,
        ...(item.group ? { group: item.group } : {}),
        ...(item.icon ? { icon: item.icon } : {}),
        ...(item.subject ? { subject: item.subject } : {}),
        ...(item.requiredAction ? { requiredAction: item.requiredAction } : {}),
      })),
    });
  }
}

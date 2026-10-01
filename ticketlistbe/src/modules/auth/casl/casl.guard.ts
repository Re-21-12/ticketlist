import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { RequestContext } from '../../../core/context/request-context.js';
import { CaslAbilityFactory } from './casl-ability.factory.js';
import { CHECK_ABILITY_KEY, type ICheckAbility } from './check-ability.decorator.js';

/** Guard global: si el handler declara `@CheckAbility`, la sesión debe tener esa habilidad. */
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ICheckAbility | undefined>(CHECK_ABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const ability = this.abilityFactory.createForUser(RequestContext.currentUser());
    if (ability.can(required.action, required.subject)) return true;
    throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN);
  }
}

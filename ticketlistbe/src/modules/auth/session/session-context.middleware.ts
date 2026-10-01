import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../../../core/context/request-context.js';
import { UsersRepository } from '../../users/users.repository.js';

/**
 * Publica en `RequestContext` el usuario de la SESIÓN (store del servidor) y el `If-Match`.
 * Guards y servicios leen de ahí. Reemplaza al `x-mock-role` del mock inicial.
 */
@Injectable()
export class SessionContextMiddleware implements NestMiddleware {
  constructor(private readonly usersRepository: UsersRepository) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const uuid = req.session?.userUuid;
    const user = uuid ? this.usersRepository.findByUuid(uuid) : null;
    const ifMatch = req.header('if-match') ?? null;
    RequestContext.run({ user, ifMatch }, () => next());
  }
}

import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { UsersRepository } from '../users/users.repository.js';
import type { TAuditAction, TAuditOutcome } from './audit-log.entity.js';
import { AUDIT_STORE, type IAuditLogStore } from './audit-log.store.js';

const ACTION_BY_METHOD: Record<string, TAuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** Rutas de autenticación con acción propia (no son «crear una sesión» genérico). */
const AUTH_ACTIONS: Record<string, TAuditAction> = {
  '/api/auth/sign-in': 'SIGN_IN',
  '/api/auth/sign-out': 'SIGN_OUT',
};

const outcomeOf = (status: number): TAuditOutcome =>
  status < 400 ? 'SUCCESS' : status === 401 || status === 403 || status === 429 ? 'DENIED' : 'FAILED';

/**
 * Auditoría de TODA mutación (POST/PUT/PATCH/DELETE), incluidas las que corta un guard (401, 403,
 * 429) — por eso es middleware y no interceptor, igual que el log de observabilidad. Las lecturas
 * no se registran (volumen y poco valor); sí el inicio y cierre de sesión.
 *
 * Se registra al TERMINAR la respuesta, cuando ya se conoce el resultado y la plantilla de ruta
 * (`req.route`). Nunca guarda valores del body ni la query: solo los NOMBRES de los campos.
 */
@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Audit');

  constructor(
    @Inject(AUDIT_STORE) private readonly audit: IAuditLogStore,
    private readonly usersRepository: UsersRepository,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    if (!(method in ACTION_BY_METHOD)) return next();

    const path = req.originalUrl.split('?')[0] ?? '';
    // Quien actuaba ANTES de la request (un sign-in cambia la sesión; un sign-out la destruye).
    const userUuidBefore = req.session?.userUuid;

    res.on('finish', () => {
      const userUuid = req.session?.userUuid ?? userUuidBefore;
      const actor = userUuid ? this.usersRepository.findAdminByUuid(userUuid) : null;
      const route = (req.baseUrl + (req.route?.path ?? '')) || path;
      const subject = (route.split('/')[2] ?? 'unknown') || 'unknown';
      const body: unknown = req.body;
      const uuidParam = req.params?.['uuid'];
      // Nunca rompe la request: si el almacén falla se registra el error y la respuesta ya se envió.
      void this.audit
        .append({
        uuid: randomUUID(),
        at: new Date(),
        action: AUTH_ACTIONS[path] ?? (ACTION_BY_METHOD[method] as TAuditAction),
        subject,
        route,
        method,
        resourceUuid: typeof uuidParam === 'string' ? uuidParam : null,
        status: res.statusCode,
        outcome: outcomeOf(res.statusCode),
        actorUuid: actor?.uuid ?? null,
        actorEmail: actor?.email ?? null,
        actorRole: actor?.role ?? null,
        ip: req.ip ?? 'desconocida',
        userAgent: (req.header('user-agent') ?? '').slice(0, 200),
        requestId: req.header('x-request-id') ?? null,
        changedFields: body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).slice(0, 30) : [],
      })
        .catch((error: unknown) => this.logger.error(`No se pudo registrar la auditoría: ${String(error)}`));
    });
    next();
  }
}

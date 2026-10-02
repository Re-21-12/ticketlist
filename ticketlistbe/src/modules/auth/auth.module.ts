import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CaslAbilityFactory } from './casl/casl-ability.factory.js';
import { CaslGuard } from './casl/casl.guard.js';
import { AccountRecoveryService } from './session/account-recovery.service.js';
import { AccountSecurityService } from './session/account-security.service.js';
import { AuthSessionService } from './session/auth-session.service.js';
import { SessionIndexService } from './session/session-index.service.js';
import { CsrfGuard } from './session/csrf.guard.js';
import { SessionAuthGuard } from './session/session-auth.guard.js';

/**
 * Dominio de autenticación/autorización. Guards GLOBALES en este orden (Nest los ejecuta en el
 * orden de registro):
 *   1. SessionAuthGuard → ¿hay sesión válida? (401 SAUT-E002 / SAUT-E005)
 *   2. CsrfGuard        → mutaciones: ¿X-XSRF-TOKEN = cookie? (403 SAUT-E003)
 *   3. CaslGuard        → ¿el rol puede la acción sobre el TIPO? (403 SAUT-E001)
 * El permiso sobre el REGISTRO (titular, concesión, condición) lo valida el servicio.
 */
@Global()
@Module({
  providers: [
    CaslAbilityFactory,
    AuthSessionService,
    SessionIndexService,
    AccountSecurityService,
    AccountRecoveryService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: CaslGuard },
  ],
  exports: [CaslAbilityFactory, AuthSessionService, SessionIndexService, AccountSecurityService, AccountRecoveryService],
})
export class AuthModule {}

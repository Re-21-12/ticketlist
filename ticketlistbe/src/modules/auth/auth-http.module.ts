import { Module } from '@nestjs/common';
import { ShellHttpModule } from '../../bff/shell/shell-http.module.js';
import { AccountRecoveryController } from './account-recovery.controller.js';
import { AccountSecurityController } from './account-security.controller.js';
import { AuthController } from './auth.controller.js';

/** Transporte: `/api/auth/sign-in|sign-out` y la seguridad de la propia cuenta (contraseña, sesiones). */
@Module({
  imports: [ShellHttpModule],
  controllers: [AuthController, AccountSecurityController, AccountRecoveryController],
})
export class AuthHttpModule {}

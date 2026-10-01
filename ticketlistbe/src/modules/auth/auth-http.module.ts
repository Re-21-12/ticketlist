import { Module } from '@nestjs/common';
import { ShellHttpModule } from '../../bff/shell/shell-http.module.js';
import { AccountSecurityController } from './account-security.controller.js';
import { AuthController } from './auth.controller.js';

/** Transporte: `/api/auth/sign-in|sign-out` y la seguridad de la propia cuenta (contraseña, sesiones). */
@Module({
  imports: [ShellHttpModule],
  controllers: [AuthController, AccountSecurityController],
})
export class AuthHttpModule {}

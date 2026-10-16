import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Con una contraseña TEMPORAL vigente solo se puede ver el shell, cambiar la contraseña y cerrar sesión; todo lo demás
 * responde 403 `SAUT-E015`. Este decorador marca los handlers que SÍ se permiten en ese estado.
 */
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un handler/controller como accesible SIN sesión (login, catálogo de problemas). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

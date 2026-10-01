import { DEV_SIGN_IN } from './dev-sign-in';
import type { IEnvironment } from './environment.interface';

/**
 * Entorno de DESARROLLO (default). `angular.json` lo reemplaza por `environment.prod.ts` en
 * `production` y por `environment.bff.ts` en `bff` (fileReplacements), igual que wallet-api.
 * Aquí NUNCA secretos: todo lo que se pone acá termina en el bundle público.
 */
export const environment: IEnvironment = {
  production: false,
  apiUrl: '/api',
  useMockBff: true,
  devSignIn: DEV_SIGN_IN,
};

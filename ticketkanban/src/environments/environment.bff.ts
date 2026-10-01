import { DEV_SIGN_IN } from './dev-sign-in';
import type { IEnvironment } from './environment.interface';

/**
 * Desarrollo contra el BFF REAL (`bun run start:dev` en ticketlistbe, proxy `/api` → :3000).
 * `npm run start:bff` (configuración `bff` de angular.json).
 */
export const environment: IEnvironment = {
  production: false,
  apiUrl: '/api',
  useMockBff: false,
  devSignIn: DEV_SIGN_IN,
};

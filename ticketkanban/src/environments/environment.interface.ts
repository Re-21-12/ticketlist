import type { EUserRole } from '../app/core/casl/ability.enum';

/**
 * Forma común de `environment.ts` / `environment.prod.ts`: tipar ambos evita que el build de
 * producción (fileReplacements) rompa por un campo que solo existe en desarrollo.
 * Todo lo que va acá termina en el bundle PÚBLICO: nunca secretos reales.
 */
export interface IEnvironment {
  production: boolean;
  /** Prefijo de la API. En dev el proxy (`proxy.conf.json`) lo manda a ticketlistbe. */
  apiUrl: string;
  /**
   * `true`: el `mockBffInterceptor` responde `/api/*` en el navegador (sin backend).
   * `false`: las requests van al BFF real vía proxy.
   */
  useMockBff: boolean;
  /**
   * SOLO desarrollo: usuarios sembrados de ticketlistbe (`users.seed.ts`) para el selector
   * «Rol de prueba», que inicia sesión como el usuario de ese rol. `null` en producción: ahí el
   * selector no se muestra.
   */
  devSignIn: { password: string; emailByRole: Record<EUserRole, string> } | null;
}

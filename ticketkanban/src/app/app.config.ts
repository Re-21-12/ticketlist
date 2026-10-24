import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { provideOptimus } from '@openng/optimus-ui/config';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { routes } from './app.routes';
import { AppAbility } from './core/casl/casl.types';
import { environment } from '../environments/environment';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { mockBffInterceptor } from './core/mock-bff/mock-bff.interceptor';
import { skipTransitionIfReducedMotion } from './core/motion/view-transition.util';
import { SessionStore } from './core/session/session.store';
import { initialThemePreset } from './core/theme/primary-preset.util';
import { ThemePaletteService } from './core/theme/theme-palette.service';
import { ThemeService } from './core/theme/theme.service';

/**
 * Orden: errorInterceptor primero (ve también los errores del mock) → mock.
 * Qué se incluye lo decide el environment (ver src/environments/). La sesión viaja en la cookie
 * `sid` y el CSRF (`X-XSRF-TOKEN`) lo agrega `HttpClient` por defecto: no hacen falta interceptores.
 */
const interceptors: HttpInterceptorFn[] = [
  errorInterceptor,
  ...(environment.useMockBff ? [mockBffInterceptor] : []),
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // En producción los errores no capturados no se imprimen en la consola (ver AppErrorHandler).
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Transición entre páginas con la View Transitions API (fallback: sin animación).
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: skipTransitionIfReducedMotion,
      }),
    ),
    provideHttpClient(withInterceptors(interceptors)),
    // Modo oscuro por la clase `.app-dark` que controla ThemeService (y el script de index.html),
    // no por `prefers-color-scheme`: la elección del usuario manda sobre la del SO.
    // Preset inicial = Aura + color guardado del usuario (ver initialThemePreset: aplicarlo después
    // quedaba pisado por provideOptimus).
    provideOptimus({
      theme: { preset: initialThemePreset(), options: { darkModeSelector: '.app-dark' } },
      // Nombres accesibles de las estrellas de «Urgencia» en español (por defecto salen en inglés).
      translation: { aria: { star: '1 estrella', stars: '{star} estrellas' } },
    }),
    // Overlays globales de app.html: `<p-toast>` y `<p-confirmdialog>`.
    MessageService,
    ConfirmationService,
    // Instancia ÚNICA de Ability (patrón oficial de @casl/angular); `SessionStore` la muta con
    // `ability.update(rules)`. Se registra bajo el token `Ability` (companion `AppAbility`), que es
    // el que inyecta `AbilityServiceSignal`.
    { provide: AppAbility, useValue: createMongoAbility() },
    // Las reglas tienen que estar cargadas ANTES de que corran los guards de la primera navegación.
    provideAppInitializer(() => inject(SessionStore).loadSession()),
    // Instancia ThemeService al arrancar (sincroniza la clase `.app-dark` con lo guardado).
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Publica la rampa tonal del color de marca (`--app-shade-*`) para barras y medidores, y se
    // vuelve a escribir cada vez que la persona elige otro color en /appearance.
    provideAppInitializer(() => {
      inject(ThemePaletteService);
    }),
  ],
};

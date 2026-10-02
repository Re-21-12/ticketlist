import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { routes } from './app.routes';
import { AppAbility } from './core/casl/casl.types';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { resetMockBff } from './core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from './core/mock-bff/mock-bff.interceptor';
import { SessionStore } from './core/session/session.store';

/**
 * Anti-bucle: cada destino al que un guard redirige (`/sign-in`, `/access`) DEBE existir. Si no, el
 * comodín `**` devuelve a la ruta protegida, el guard redirige otra vez… y la pantalla queda en negro
 * con la CPU al 100 %.
 */
describe('rutas de la app sin sesión', () => {
  let router: Router;

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        provideOptimus({}),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    await TestBed.inject(SessionStore).loadSession();
    router = TestBed.inject(Router);
  });

  it('/ (raíz) sin sesión también aterriza en /sign-in', async () => {
    await router.navigateByUrl('/');
    expect(router.url).toBe('/sign-in?returnUrl=%2Ftickets');
  });

  it.each(['/tickets', '/profile'])('%s sin sesión aterriza en /sign-in con returnUrl (sin bucle)', async (url) => {
    await router.navigateByUrl(url);
    expect(router.url).toBe(`/sign-in?returnUrl=${encodeURIComponent(url)}`);
  });

  it.each(['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/access'])(
    '%s existe y se atiende a sí misma',
    async (url) => {
      await router.navigateByUrl(url);
      expect(router.url).toBe(url);
    },
  );
});

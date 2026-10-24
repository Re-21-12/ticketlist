import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { resetMockBff } from '../mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../mock-bff/mock-bff.interceptor';
import { SessionStore } from '../session/session.store';
import { errorInterceptor } from './error.interceptor';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

/**
 * Sesión perdida a mitad de uso (expiró por inactividad, se cerró en otra pestaña): SAUT-E002 NO se muestra como un
 * aviso técnico; si había sesión se avisa una vez en lenguaje llano y se lleva a /sign-in recordando la pantalla.
 */
describe('errorInterceptor · sesión perdida (SAUT-E002)', () => {
  let store: SessionStore;
  let http: HttpClient;
  let router: Router;
  let toast: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    resetMockBff();
    toast = { add: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sign-in', component: Blank },
          { path: 'tickets', component: Blank },
        ]),
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: toast },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/tickets');
  });

  it('con sesión: avisa «Tu sesión terminó» (sin el código), limpia la sesión y lleva a /sign-in con returnUrl', async () => {
    await store.signInAs(EUserRole.VIEWER);
    resetMockBff(); // el servidor ya no conoce la sesión: la siguiente petición es 401 SAUT-E002
    await firstValueFrom(http.get('/api/tickets')).catch(() => undefined);
    expect(store.$isAuthenticated()).toBe(false);
    expect(toast.add).toHaveBeenCalledTimes(1);
    const message = toast.add.mock.calls[0][0] as { summary: string; detail: string };
    expect(message.summary).toBe('Tu sesión terminó');
    expect(JSON.stringify(message)).not.toContain('SAUT-E002');
    await vi.waitFor(() => expect(router.url).toBe('/sign-in?returnUrl=%2Ftickets'));
  });

  it('varias peticiones fallan a la vez: el aviso sale UNA sola vez', async () => {
    await store.signInAs(EUserRole.VIEWER);
    resetMockBff();
    await Promise.all([firstValueFrom(http.get('/api/tickets')), firstValueFrom(http.get('/api/notifications'))].map((p) => p.catch(() => undefined)));
    expect(toast.add).toHaveBeenCalledTimes(1);
  });

  it('sin sesión previa (peticiones tras cerrar sesión): no avisa ni redirige', async () => {
    await firstValueFrom(http.get('/api/tickets')).catch(() => undefined);
    expect(toast.add).not.toHaveBeenCalled();
    expect(router.url).toBe('/tickets');
  });

  it('otras 401 (credenciales incorrectas) se siguen mostrando con su título y su código', async () => {
    await firstValueFrom(http.post('/api/auth/sign-in', { email: 'victor@ticketit.dev', password: 'incorrecta1' })).catch(() => undefined);
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Correo electrónico o contraseña incorrectos' }));
  });
});

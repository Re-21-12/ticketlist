import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { mockBffInterceptor } from '../mock-bff/mock-bff.interceptor';
import { SessionStore } from './session.store';

/**
 * Contrato de sesión contra el BFF falso (mismo contrato que ticketlistbe): 401 sin sesión,
 * sign-in con los usuarios sembrados, sign-out y errores RFC 9457.
 */
describe('SessionStore (con el mock del BFF)', () => {
  let store: SessionStore;
  let ability: AppAbility;
  let http: HttpClient;
  let toast: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { add: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: toast },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    store = TestBed.inject(SessionStore);
    ability = TestBed.inject(AppAbility);
    http = TestBed.inject(HttpClient);
  });

  it('sin sesión (401) inicia sesión como el agente de desarrollo, sin toast', async () => {
    await store.loadSession();
    expect(store.$role()).toBe(EUserRole.AGENT);
    expect(ability.can('create', 'Ticket')).toBe(true);
    expect(toast.add).not.toHaveBeenCalled();
  });

  it('cambiar de rol recalcula las reglas; cerrar sesión las vacía y el BFF responde 401 Problem Details', async () => {
    await store.signInAs(EUserRole.VIEWER);
    expect(store.$user()?.email).toBe('victor@ticketit.dev');
    expect(ability.can('create', 'Ticket')).toBe(false);

    await store.signOut();
    expect(store.$isAuthenticated()).toBe(false);
    expect(ability.rules).toEqual([]);

    const error = await firstValueFrom(http.get('/api/tickets')).catch((e: unknown) => e);
    const problem = readProblem(error);
    expect(problem).toMatchObject({ status: 401, code: 'SAUT-E002', type: '/api/problems/SAUT-E002' });
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ summary: problem!.title }));
  });

  it('400 de validación: errors[] con JSON Pointer', async () => {
    await store.signInAs(EUserRole.AGENT);
    const error = await firstValueFrom(http.post('/api/tickets', { title: 'ab' })).catch((e: unknown) => e);
    const problem = readProblem(error);
    expect(problem?.code).toBe('CVAL-E001');
    expect(problem?.errors).toContainEqual(expect.objectContaining({ pointer: '#/title', path: 'title' }));
  });
});

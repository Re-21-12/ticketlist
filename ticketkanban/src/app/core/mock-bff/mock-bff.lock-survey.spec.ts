import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

const ANA = 'ana@ticketit.dev';
const ANA_UUID = '0b8a5f6e-1c2d-4e3f-8a9b-000000000002';
const TCK_003 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e03'; // cerrado, solicitado por Luis (agente)

interface INotice {
  type: string;
  resourceUuid: string | null;
  message: string;
}

/** Bloqueo por intentos fallidos (CU07 A3) y encuesta de satisfacción al cerrarse un ticket: mismos contratos que el backend. */
describe('mock BFF · bloqueo de cuenta y encuesta de satisfacción', () => {
  let store: SessionStore;
  let http: HttpClient;

  beforeEach(() => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpClient);
  });

  const signIn = (email: string, password: string) => firstValueFrom(http.post('/api/auth/sign-in', { email, password }));
  const codeOf = async (promise: Promise<unknown>) => readProblem(await promise.catch((e: unknown) => e));

  async function lockAna() {
    for (let i = 0; i < 4; i++) expect((await codeOf(signIn(ANA, 'mala')))?.code).toBe('SAUT-E004');
    return codeOf(signIn(ANA, 'mala')); // el 5.º intento la bloquea
  }

  describe('bloqueo', () => {
    it('5 fallos seguidos bloquean (423 SAUT-E014 con el contacto de los administradores), aunque luego se acierte', async () => {
      const locking = await lockAna();
      expect(locking?.code).toBe('SAUT-E014');
      expect(locking?.context?.['contacts']).toEqual(expect.arrayContaining([{ name: 'Marta Admin', email: 'marta@ticketit.dev' }]));
      expect((await codeOf(signIn(ANA, 'ticketit-dev')))?.code).toBe('SAUT-E014');
    });

    it('un acierto reinicia el contador; una cuenta inexistente nunca se bloquea', async () => {
      for (let i = 0; i < 4; i++) await codeOf(signIn(ANA, 'mala'));
      await signIn(ANA, 'ticketit-dev');
      for (let i = 0; i < 4; i++) await codeOf(signIn(ANA, 'mala'));
      await signIn(ANA, 'ticketit-dev');
      for (let i = 0; i < 6; i++) expect((await codeOf(signIn('nadie@ticketit.dev', 'mala')))?.code).toBe('SAUT-E004');
    });

    it('el administrador la ve bloqueada, recibe el aviso, la desbloquea y la persona vuelve a entrar; otros roles no pueden', async () => {
      await lockAna();
      await store.signInAs(EUserRole.SUPERVISOR);
      expect((await codeOf(firstValueFrom(http.patch(`/api/users/${ANA_UUID}/status`, { disabled: false, locked: false }))))?.code).toBe('SAUT-E001');
      await store.signOut();

      await store.signInAs(EUserRole.ADMIN);
      const row = (await firstValueFrom(http.get(`/api/users/${ANA_UUID}`))) as { locked: boolean; lockedAt: string | null };
      expect(row.locked).toBe(true);
      const notices = (await firstValueFrom(http.get<{ data: INotice[] }>('/api/notifications'))).data;
      expect(notices.some((n) => n.type === 'ACCOUNT_LOCKED' && n.message.includes(ANA))).toBe(true);

      expect((await codeOf(firstValueFrom(http.patch(`/api/users/${ANA_UUID}/status`, { disabled: false, locked: true }))))?.code).toBe('CVAL-E001');
      const unlocked = (await firstValueFrom(http.patch(`/api/users/${ANA_UUID}/status`, { disabled: false, locked: false }))) as { locked: boolean };
      expect(unlocked.locked).toBe(false);
      await store.signOut();
      await signIn(ANA, 'ticketit-dev');
    });
  });

  describe('encuesta al cerrarse el ticket', () => {
    it('quien solicitó el ticket cerrado recibe la notificación, califica 1–5 y no puede calificar dos veces', async () => {
      await signIn('luis@ticketit.dev', 'ticketit-dev');
      const notices = (await firstValueFrom(http.get<{ data: INotice[] }>('/api/notifications'))).data;
      const survey = notices.find((n) => n.type === 'TICKET_SURVEY');
      expect(survey?.resourceUuid).toBe(TCK_003);

      expect(((await firstValueFrom(http.get(`/api/tickets/${TCK_003}/survey`))) as { state: string }).state).toBe('pending');
      expect((await codeOf(firstValueFrom(http.post(`/api/tickets/${TCK_003}/survey`, { resolved: true, score: 6 }))))?.code).toBe('CVAL-E001');
      // Decir si se resolvió el problema es obligatorio (CU02).
      expect((await codeOf(firstValueFrom(http.post(`/api/tickets/${TCK_003}/survey`, { score: 5 }))))?.code).toBe('CVAL-E001');
      const answered = (await firstValueFrom(http.post(`/api/tickets/${TCK_003}/survey`, { resolved: true, score: 5, comment: 'Excelente' }))) as { state: string; score: number };
      expect(answered).toMatchObject({ state: 'answered', score: 5, resolved: true });
      expect((await codeOf(firstValueFrom(http.post(`/api/tickets/${TCK_003}/survey`, { resolved: false, score: 3 }))))?.code).toBe('SSRV-E002');

      const after = (await firstValueFrom(http.get<{ data: INotice[] }>('/api/notifications'))).data;
      expect(after.some((n) => n.type === 'TICKET_SURVEY')).toBe(false); // ya calificó: deja de aparecer
    });

    it('otra persona no ve la encuesta (404 SSRV-E001, anti-enumeración)', async () => {
      await store.signInAs(EUserRole.ADMIN);
      expect((await codeOf(firstValueFrom(http.get(`/api/tickets/${TCK_003}/survey`))))?.code).toBe('SSRV-E001');
    });
  });
});

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

interface ICredential {
  user: { uuid: string; email: string; role: string; mustChangePassword: boolean; totpEnabled: boolean };
  tempPassword: string;
  expiresAt: string;
}

const NEW_PASSWORD = 'Mi-Clave-Nueva-2026!';

/** Cuentas por la administración (mismas reglas que `admin-accounts.e2e-spec.ts` del backend): alta, temporal de un solo uso, TOTP. */
describe('mock BFF · cuentas por la administración', () => {
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

  const post = <T = unknown>(url: string, body?: object) => firstValueFrom(http.post<T>(url, body ?? {}));
  const codeOf = async (promise: Promise<unknown>) => readProblem(await promise.catch((e: unknown) => e))?.code;
  const create = () => post<ICredential>('/api/users', { name: 'Nuevo Soporte', email: 'Nuevo@Ticketit.dev', role: 'AGENT' });

  it('solo un administrador crea o restablece (403)', async () => {
    await store.signInAs(EUserRole.AGENT);
    expect(await codeOf(create())).toBe('SAUT-E001');
  });

  it('crear: contraseña temporal una vez, correo normalizado, duplicado 409 y datos inválidos 400', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const credential = await create();
    expect(credential.user).toMatchObject({ email: 'nuevo@ticketit.dev', role: 'AGENT', mustChangePassword: true, totpEnabled: false });
    expect(credential.tempPassword).toHaveLength(16);
    expect(credential.tempPassword).toMatch(/[A-Z]/);
    expect(credential.tempPassword).toMatch(/[a-z]/);
    expect(credential.tempPassword).toMatch(/\d/);
    expect(await codeOf(create())).toBe('SUSR-E001');
    expect(await codeOf(post('/api/users', { name: 'Otro', email: 'no-es-correo', role: 'AGENT' }))).toBe('CVAL-E001');
  });

  it('con la temporal solo se puede cambiar la contraseña (403 SAUT-E015 en lo demás); al cambiarla queda libre', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const { tempPassword } = await create();
    await store.signOut();

    await store.signIn({ email: 'nuevo@ticketit.dev', password: tempPassword });
    expect(store.$mustChangePassword()).toBe(true);
    expect(await codeOf(firstValueFrom(http.get('/api/tickets')))).toBe('SAUT-E015');

    await firstValueFrom(http.patch('/api/auth/password', { currentPassword: tempPassword, newPassword: NEW_PASSWORD }));
    await store.loadSession();
    expect(store.$mustChangePassword()).toBe(false);
    expect(await firstValueFrom(http.get('/api/tickets'))).toBeTruthy();

    await store.signOut();
    expect(await store.signIn({ email: 'nuevo@ticketit.dev', password: tempPassword }).catch((e: unknown) => readProblem(e)?.code)).toBe('SAUT-E004');
  });

  it('restablecer contraseña: temporal nueva, la anterior deja de servir y no se hace sobre uno mismo', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const users = await firstValueFrom(http.get<{ data: { uuid: string; email: string }[] }>('/api/users'));
    const victor = users.data.find((u) => u.email === 'victor@ticketit.dev')!;
    const marta = users.data.find((u) => u.email === 'marta@ticketit.dev')!;

    expect(await codeOf(post(`/api/users/${marta.uuid}/reset-password`))).toBe('SUSR-E003');
    const reset = await post<ICredential>(`/api/users/${victor.uuid}/reset-password`);
    expect(reset.user.mustChangePassword).toBe(true);
    await store.signOut();
    expect(await store.signIn({ email: 'victor@ticketit.dev', password: 'ticketit-dev' }).catch((e: unknown) => readProblem(e)?.code)).toBe('SAUT-E004');
    await store.signIn({ email: 'victor@ticketit.dev', password: reset.tempPassword });
    expect(store.$mustChangePassword()).toBe(true);
  });

  it('restablecer TOTP: quita el autenticador de la persona', async () => {
    await store.signInAs(EUserRole.AGENT);
    await post('/api/auth/totp/setup');
    await post('/api/auth/totp/enable', { code: '123456' });
    await store.signOut();

    await store.signInAs(EUserRole.ADMIN);
    const users = await firstValueFrom(http.get<{ data: { uuid: string; email: string; totpEnabled: boolean }[] }>('/api/users'));
    const ana = users.data.find((u) => u.email === 'ana@ticketit.dev')!;
    expect(ana.totpEnabled).toBe(true);
    const updated = await post<{ totpEnabled: boolean }>(`/api/users/${ana.uuid}/reset-totp`);
    expect(updated.totpEnabled).toBe(false);
  });
});

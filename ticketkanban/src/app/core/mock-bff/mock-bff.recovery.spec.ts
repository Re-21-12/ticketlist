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
import { MOCK_TOTP_CODE, resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

const NEW_PASSWORD = 'Nueva-Clave-2026!';

/** Recuperar sin correo: código del autenticador (TOTP) o contraseña actual. Mismos códigos que el backend. */
describe('mock BFF · recuperación con segundo factor', () => {
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

  const post = (url: string, body?: object) => firstValueFrom(http.post(url, body ?? {}));
  const codeOf = async (promise: Promise<unknown>) => readProblem(await promise.catch((e: unknown) => e))?.code;

  it('el autenticador se configura en dos pasos: setup → enable (código malo 422, sin setup 409)', async () => {
    await store.signInAs(EUserRole.AGENT);
    expect(await firstValueFrom(http.get('/api/auth/totp'))).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    expect(await codeOf(post('/api/auth/totp/enable', { code: MOCK_TOTP_CODE }))).toBe('SAUT-E012');
    const setup = (await post('/api/auth/totp/setup')) as { secret: string; otpauthUrl: string };
    expect(setup.otpauthUrl).toContain(setup.secret);
    expect(await codeOf(post('/api/auth/totp/enable', { code: '000000' }))).toBe('SAUT-E011');
    const enabled = (await post('/api/auth/totp/enable', { code: MOCK_TOTP_CODE })) as { recoveryCodes: string[] };
    expect(enabled.recoveryCodes).toHaveLength(10);
    expect(await firstValueFrom(http.get('/api/auth/totp'))).toEqual({ enabled: true, recoveryCodesLeft: 10 });
    expect(await codeOf(post('/api/auth/totp/setup'))).toBe('SAUT-E013');
    expect(await codeOf(post('/api/auth/totp/disable', { currentPassword: 'mala' }))).toBe('SAUT-E006');
  });

  it('con el código TOTP la persona elige su contraseña nueva y la anterior deja de servir', async () => {
    await store.signInAs(EUserRole.AGENT);
    await post('/api/auth/totp/setup');
    await post('/api/auth/totp/enable', { code: MOCK_TOTP_CODE });
    await store.signOut();
    await post('/api/auth/recover-password', { method: 'totp', email: 'ana@ticketit.dev', code: MOCK_TOTP_CODE, newPassword: NEW_PASSWORD });
    await store.signIn({ email: 'ana@ticketit.dev', password: NEW_PASSWORD });
    expect(store.$user()?.email).toBe('ana@ticketit.dev');
  });

  it('cualquier fallo da la MISMA respuesta (SAUT-E010): cuenta inexistente, sin autenticador o código malo', async () => {
    const totp = (email: string, code = '000000') => post('/api/auth/recover-password', { method: 'totp', email, code, newPassword: NEW_PASSWORD });
    expect(await codeOf(totp('nadie@ticketit.dev'))).toBe('SAUT-E010');
    expect(await codeOf(totp('ana@ticketit.dev', MOCK_TOTP_CODE))).toBe('SAUT-E010'); // existe, pero sin autenticador
    expect(await codeOf(post('/api/auth/recover-password', { method: 'current_password', email: 'ana@ticketit.dev', currentPassword: 'mala', newPassword: NEW_PASSWORD }))).toBe('SAUT-E010');
  });

  it('códigos de recuperación: sirven UNA vez (aun escritos en minúsculas y sin guion), se regeneran con la contraseña y caen al desactivar', async () => {
    await store.signInAs(EUserRole.AGENT);
    await post('/api/auth/totp/setup');
    const { recoveryCodes } = (await post('/api/auth/totp/enable', { code: MOCK_TOTP_CODE })) as { recoveryCodes: string[] };
    const byCode = (recoveryCode: string) => post('/api/auth/recover-password', { method: 'recovery_code', email: 'ana@ticketit.dev', recoveryCode, newPassword: NEW_PASSWORD });

    // Regenerar: contraseña mal → 422; bien → 10 nuevos y los anteriores dejan de valer.
    expect(await codeOf(post('/api/auth/totp/recovery-codes', { currentPassword: 'mala' }))).toBe('SAUT-E006');
    const fresh = (await post('/api/auth/totp/recovery-codes', { currentPassword: 'ticketit-dev' })) as { recoveryCodes: string[] };
    expect(fresh.recoveryCodes).toHaveLength(10);
    await store.signOut();
    expect(await codeOf(byCode(recoveryCodes[0] as string))).toBe('SAUT-E010');

    const typed = (fresh.recoveryCodes[0] as string).replace('-', '').toLowerCase();
    await byCode(typed);
    expect(await codeOf(byCode(fresh.recoveryCodes[0] as string))).toBe('SAUT-E010'); // ya se usó
    expect(await codeOf(byCode('12'))).toBe('CVAL-E001');
    await store.signIn({ email: 'ana@ticketit.dev', password: NEW_PASSWORD });
    expect(await firstValueFrom(http.get('/api/auth/totp'))).toEqual({ enabled: true, recoveryCodesLeft: 9 });

    await post('/api/auth/totp/disable', { currentPassword: NEW_PASSWORD });
    expect(await firstValueFrom(http.get('/api/auth/totp'))).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    expect(await codeOf(post('/api/auth/totp/recovery-codes', { currentPassword: NEW_PASSWORD }))).toBe('SAUT-E017');
  });

  it('con la contraseña actual: cambia a una nueva; código mal formado y método desconocido → 400', async () => {
    const withPassword = (currentPassword: string, newPassword: string) =>
      post('/api/auth/recover-password', { method: 'current_password', email: 'ana@ticketit.dev', currentPassword, newPassword });
    await withPassword('ticketit-dev', NEW_PASSWORD);
    expect(await codeOf(withPassword(NEW_PASSWORD, NEW_PASSWORD))).toBe('SAUT-E007');
    expect(await codeOf(post('/api/auth/recover-password', { method: 'totp', email: 'ana@ticketit.dev', code: '12', newPassword: NEW_PASSWORD }))).toBe('CVAL-E001');
    expect(await codeOf(post('/api/auth/recover-password', { method: 'otro' }))).toBe('CVAL-E001');
  });
});

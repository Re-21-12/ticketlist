import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { EUserRole } from '../../core/casl/ability.enum';
import { AppAbility } from '../../core/casl/casl.types';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { readProblem } from '../../core/interfaces/problem-details.interface';
import { resetMockBff } from '../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../../core/session/session.store';
import { ChangePasswordFormSchema } from './profile.schema';
import { ProfileStore } from './profile.store';

const STRONG = 'Nueva-Clave-2026!';

/** Espera a que un `httpResource` termine de cargar (el mock responde con latencia). */
async function until(condition: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('Tiempo de espera agotado');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function problemOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpErrorResponse);
  return readProblem(error);
}

describe('ProfileStore (contra el mock del BFF: mismos códigos que el backend)', () => {
  let store: ProfileStore;
  let session: SessionStore;

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    session = TestBed.inject(SessionStore);
    store = TestBed.inject(ProfileStore);
    await session.signInAs(EUserRole.AGENT);
  });

  describe('cambiar contraseña', () => {
    it('la actual incorrecta → SAUT-E006 y la FSM queda en failed', async () => {
      const problem = await problemOf(store.changePassword({ currentPassword: 'no-es-esa', newPassword: STRONG }));
      expect(problem).toMatchObject({ status: 422, code: 'SAUT-E006' });
      expect(store.$passwordState()).toBe('failed');
    });

    it('igual a la actual → SAUT-E007', async () => {
      await store.changePassword({ currentPassword: 'ticketit-dev', newPassword: STRONG });
      const problem = await problemOf(store.changePassword({ currentPassword: STRONG, newPassword: STRONG }));
      expect(problem?.code).toBe('SAUT-E007');
    });

    it('una contraseña débil → CVAL-E001 con el campo y qué falta', async () => {
      const problem = await problemOf(store.changePassword({ currentPassword: 'ticketit-dev', newPassword: 'sololetras' }));
      expect(problem?.code).toBe('CVAL-E001');
      expect(problem?.errors?.[0]).toMatchObject({
        path: 'newPassword',
        message: 'Agrega: mayúscula, número, símbolo (!@#$%)',
      });
    });

    it('éxito → saved; y mientras se guarda, un segundo envío no es una transición válida', async () => {
      const first = store.changePassword({ currentPassword: 'ticketit-dev', newPassword: STRONG });
      expect(store.$changingPassword()).toBe(true);
      await expect(store.changePassword({ currentPassword: 'ticketit-dev', newPassword: STRONG })).rejects.toThrow(
        'Ya hay un cambio en curso',
      );
      await first;
      expect(store.$passwordState()).toBe('saved');
    });
  });

  describe('sesiones', () => {
    it('cierra una sesión ajena y no deja cerrar la actual', async () => {
      store.reloadSessions();
      const list = () => {
        const state = store.$sessionsState();
        return state.kind === 'success' ? state.data.data : [];
      };
      await until(() => list().length === 2);
      const other = list().find((s) => !s.current)!;
      const current = list().find((s) => s.current)!;

      expect((await problemOf(store.revokeSession(current.id)))?.code).toBe('SSES-E001');
      expect((await problemOf(store.revokeSession('no-existe')))?.code).toBe('RSES-E001');

      await store.revokeSession(other.id);
      await until(() => list().length === 1);
      expect(list()[0].current).toBe(true);
    });

    it('cambiar la contraseña cierra las demás sesiones', async () => {
      store.reloadSessions();
      const count = () => {
        const state = store.$sessionsState();
        return state.kind === 'success' ? state.data.data.length : -1;
      };
      await until(() => count() === 2);
      await store.changePassword({ currentPassword: 'ticketit-dev', newPassword: STRONG });
      await until(() => count() === 1);
    });
  });

  describe('avatar', () => {
    it('guarda y se refleja en la sesión sin pedir el shell de nuevo', async () => {
      await store.updateAvatar({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' });
      expect(session.$user()).toMatchObject({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' });
    });

    it('una lista cerrada: un valor fuera de ella → CVAL-E001', async () => {
      const problem = await problemOf(
        store.updateAvatar({ avatarIcon: 'pi-bomba' as never, avatarColor: null }),
      );
      expect(problem?.code).toBe('CVAL-E001');
    });
  });

  describe('notificaciones', () => {
    it('lista las mías, cuenta las sin leer y marca una como leída', async () => {
      store.reloadNotifications();
      await until(() => store.$unreadNotifications() === 1);
      const state = store.$notificationsState();
      expect(state.kind).toBe('success');
      const unread = state.kind === 'success' ? state.data.data.find((n) => !n.readAt)! : null;

      await store.markNotificationRead(unread!.uuid);
      await until(() => store.$unreadNotifications() === 0);
    });
  });
});

describe('ChangePasswordFormSchema (mensajes = los del backend)', () => {
  const valid = { currentPassword: 'x', newPassword: STRONG, confirmPassword: STRONG };
  const firstMessage = (input: object) => ChangePasswordFormSchema.safeParse(input).error?.issues[0]?.message;

  it('acepta una contraseña fuerte confirmada', () => {
    expect(ChangePasswordFormSchema.safeParse(valid).success).toBe(true);
  });

  it('dice QUÉ falta, con el mismo texto del backend', () => {
    expect(firstMessage({ ...valid, newPassword: 'sololetras', confirmPassword: 'sololetras' })).toBe(
      'Agrega: mayúscula, número, símbolo (!@#$%)',
    );
  });

  it('largo mínimo y máximo', () => {
    expect(firstMessage({ ...valid, newPassword: 'Ab1!', confirmPassword: 'Ab1!' })).toBe(
      'La contraseña debe tener al menos 8 caracteres',
    );
    const long = 'Aa1!'.repeat(33);
    expect(firstMessage({ ...valid, newPassword: long, confirmPassword: long })).toBe(
      'La contraseña no debe superar 128 caracteres',
    );
  });

  it('la confirmación distinta se reporta en confirmPassword aunque la nueva sea débil', () => {
    const issues = ChangePasswordFormSchema.safeParse({ ...valid, newPassword: 'sololetras', confirmPassword: 'otra' }).error?.issues;
    expect(issues?.map((i) => i.path.join('.'))).toEqual(expect.arrayContaining(['newPassword', 'confirmPassword']));
  });
});

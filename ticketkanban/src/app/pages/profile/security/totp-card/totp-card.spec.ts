import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { EUserRole } from '../../../../core/casl/ability.enum';
import { AppAbility } from '../../../../core/casl/casl.types';
import { errorInterceptor } from '../../../../core/interceptors/error.interceptor';
import { MOCK_TOTP_CODE, resetMockBff } from '../../../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../../../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../../../../core/session/session.store';
import { TotpCard } from './totp-card';

/** Autenticador: QR + clave copiable, confirmación con un código y los 10 códigos de recuperación de un solo uso. */
describe('TotpCard', () => {
  const WAIT = { timeout: 8000, interval: 100 };
  let fixture: ComponentFixture<TotpCard>;
  let root: HTMLElement;

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        provideOptimus({}),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    await TestBed.inject(SessionStore).signInAs(EUserRole.AGENT);
    fixture = TestBed.createComponent(TotpCard);
    fixture.autoDetectChanges();
    root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(root.textContent).toContain('No configurado'), WAIT);
  });

  const button = (text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  async function enroll(): Promise<void> {
    button('Configurar autenticador')?.click();
    await vi.waitFor(() => expect(root.querySelector('.totp-secret')).not.toBeNull(), WAIT);
    const input = root.querySelector<HTMLInputElement>('#field-code') as HTMLInputElement;
    input.value = MOCK_TOTP_CODE;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (root.querySelector('app-dynamic-form form') as HTMLFormElement).requestSubmit();
    await vi.waitFor(() => expect(root.querySelector('.totp-code-grid')).not.toBeNull(), WAIT);
  }

  it('el alta muestra los pasos 1 y 2 con la clave y el botón para copiarla', async () => {
    button('Configurar autenticador')?.click();
    await vi.waitFor(() => expect(root.querySelector('.totp-secret')).not.toBeNull(), WAIT);
    expect(root.textContent).toContain('Escanea el código QR');
    expect(root.textContent).toContain('Confirma con un código');
    expect(button('Copiar clave')).toBeDefined();
    expect(root.querySelector('.totp-secret code')?.textContent?.trim()).toMatch(/^(\w{4} )+\w{4}$/);
  });

  it('al confirmar entrega los 10 códigos de recuperación y no se cierra hasta marcar que se guardaron', async () => {
    await enroll();
    expect(root.querySelectorAll('.totp-code').length).toBe(10);
    expect(button('Copiar')).toBeDefined();
    expect(button('Descargar')).toBeDefined();
    expect(button('Imprimir')).toBeDefined();
    const done = button('Listo') as HTMLButtonElement;
    expect(done.disabled).toBe(true);

    const ack = root.querySelector<HTMLInputElement>('.totp-ack input') as HTMLInputElement;
    ack.checked = true;
    ack.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect((button('Listo') as HTMLButtonElement).disabled).toBe(false);
    (button('Listo') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(root.textContent).toContain('Te quedan'), WAIT);
    expect(root.querySelector('.totp-code-grid')).toBeNull(); // los códigos no se vuelven a mostrar
    expect(root.textContent).toContain('10');
    expect(button('Generar códigos nuevos')).toBeDefined();
  });
});

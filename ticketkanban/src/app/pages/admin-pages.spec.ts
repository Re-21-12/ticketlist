import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { EUserRole } from '../core/casl/ability.enum';
import { AppAbility } from '../core/casl/casl.types';
import { errorInterceptor } from '../core/interceptors/error.interceptor';
import { resetMockBff } from '../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../core/session/session.store';
import { AuditLogs } from './audit-logs/audit-logs';
import { Catalogs } from './catalogs/catalogs';
import { MenuItems } from './menu-items/menu-items';
import { RoleMatrix } from './role-matrix/role-matrix';
import { RolePermissions } from './role-permissions/role-permissions';
import { RelationPermissions } from './relation-permissions/relation-permissions';
import { Sharing } from './sharing/sharing';
import { Users } from './users/users';

/**
 * Las pantallas de administración se pintan con datos del mock (mismos contratos que el backend):
 * esto cubre lo que los specs de contrato no ven — que el schema, la config del formulario y el
 * template encajan (una clave mal escrita en `defineForm` o un `null` en un input de texto revientan
 * aquí, no en producción).
 */
describe('pantallas de administración (render con el mock del BFF)', () => {
  const WAIT = { timeout: 8000, interval: 100 };

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        provideOptimus({}),
        MessageService,
        ConfirmationService,
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    await TestBed.inject(SessionStore).signInAs(EUserRole.ADMIN);
  });

  async function render<T>(component: Type<T>): Promise<{ fixture: ComponentFixture<T>; root: HTMLElement }> {
    const fixture = TestBed.createComponent(component);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const rows = (root: HTMLElement) => root.querySelectorAll('tbody tr:not(.p-datatable-empty-message)').length;
  const buttonTexts = (root: HTMLElement) => [...root.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');

  it('Permisos por rol: lista el sembrado y ofrece «Nuevo permiso»', async () => {
    const { root } = await render(RolePermissions);
    // La primera página trae 10 (hay 22 reglas sembradas).
    await vi.waitFor(() => expect(rows(root)).toBe(10), WAIT);
    expect(buttonTexts(root)).toContain('Nuevo permiso');
    expect(root.textContent).toContain('Administrador');
  });

  it('Usuarios: lista las cuentas y NO ofrece alta', async () => {
    const { root } = await render(Users);
    await vi.waitFor(() => expect(rows(root)).toBe(7), WAIT);
    expect(buttonTexts(root).some((text) => text.startsWith('Nuevo'))).toBe(false);
    expect(root.textContent).toContain('ana@ticketit.dev');
  });

  it('Menú: lista los ítems del menú sembrado', async () => {
    const { root } = await render(MenuItems);
    await vi.waitFor(() => expect(rows(root)).toBe(18), WAIT);
    expect(root.textContent).toContain('Matriz de roles');
  });

  it('Auditoría: muestra el inicio de sesión del administrador y es solo lectura', async () => {
    const { root } = await render(AuditLogs);
    await vi.waitFor(() => expect(rows(root)).toBeGreaterThan(0), WAIT);
    expect(root.textContent).toContain('Inicio de sesión');
    expect(buttonTexts(root).some((text) => text.startsWith('Nuevo'))).toBe(false);
  });

  it('Catálogos: lista los de sistema; al elegir uno muestra sus elementos sin «Eliminar» en los de sistema', async () => {
    const { fixture, root } = await render(Catalogs);
    await vi.waitFor(() => expect(root.querySelectorAll('.catalog-pick').length).toBe(6), WAIT);
    const estado = [...root.querySelectorAll<HTMLButtonElement>('.catalog-pick')].find((pick) => pick.textContent?.includes('Estado de ticket'))!;
    estado.click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(rows(root)).toBe(8), WAIT);
    expect(root.textContent).toContain('pending_customer');
    expect(buttonTexts(root)).not.toContain('Eliminar');
  });

  it('Matriz de roles: el administrador lo tiene heredado; conceder a un rol cambia la celda', async () => {
    const { fixture, root } = await render(RoleMatrix);
    const checks = () => [...root.querySelectorAll<HTMLInputElement>('.matrix-check')];
    await vi.waitFor(() => expect(checks().length).toBeGreaterThan(0), WAIT);
    expect(checks().every((check) => check.checked && check.disabled)).toBe(true); // `manage all` → heredado

    [...root.querySelectorAll<HTMLInputElement>('.matrix-role input')].find((input) => input.closest('.matrix-role')?.textContent?.includes('Cliente'))!.click(); // Cliente
    fixture.detectChanges();
    const ticketsRow = () => [...root.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th')?.textContent?.trim() === 'Tickets')!;
    const boxes = () => [...ticketsRow().querySelectorAll<HTMLInputElement>('input')];
    await vi.waitFor(() => expect(boxes().map((box) => box.checked)).toEqual([true, false, false, false, false]), WAIT); // solo «Crear»

    boxes()[1].click(); // conceder «Leer»
    await vi.waitFor(() => expect(boxes()[1].checked).toBe(true), WAIT);
    expect(root.textContent).toContain('Cliente');
  });

  it('Compartir: sin relaciones muestra el vacío y «Compartir con alguien» abre el formulario', async () => {
    const { root } = await render(Sharing);
    await vi.waitFor(() => expect(root.textContent).toContain('Todavía no compartes tus tickets con nadie'), WAIT);
    const open = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('Compartir con alguien'))!;
    open.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Consentimiento'), WAIT);
    expect(document.body.textContent).toContain('Correo de la persona');
    TestBed.inject(MessageService).clear();
  });

  it('Relaciones (admin): sin datos muestra el vacío y no ofrece alta ni «Revocar» en lo revocado', async () => {
    const { root } = await render(RelationPermissions);
    await vi.waitFor(() => expect(root.querySelector('table')).not.toBeNull(), WAIT);
    expect(buttonTexts(root).some((text) => text.startsWith('Nuevo'))).toBe(false);
    expect(root.textContent).toContain('Estado');
  });
});

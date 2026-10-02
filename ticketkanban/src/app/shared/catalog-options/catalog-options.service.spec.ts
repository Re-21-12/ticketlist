import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { EUserRole } from '../../core/casl/ability.enum';
import { AppAbility } from '../../core/casl/casl.types';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { resetMockBff } from '../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../../core/session/session.store';
import { CatalogOptionsService } from './catalog-options.service';

const FALLBACK = [
  { value: 'low', label: 'Baja (respaldo)' },
  { value: 'medium', label: 'Media (respaldo)' },
  { value: 'high', label: 'Alta (respaldo)' },
  { value: 'critical', label: 'Crítica (respaldo)' },
];

/** Las opciones de los formularios salen del catálogo; mientras carga o si falla, del respaldo del contrato. */
describe('CatalogOptionsService', () => {
  beforeEach(() => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
  });

  it('antes de cargar usa el respaldo; después, las etiquetas del catálogo; renombrar y recargar las actualiza', async () => {
    await TestBed.inject(SessionStore).signInAs(EUserRole.ADMIN);
    const service = TestBed.inject(CatalogOptionsService);
    const options = service.options('ticket-priority', FALLBACK);
    expect(options().map((o) => o.label)).toEqual(FALLBACK.map((o) => o.label));

    await vi.waitFor(() => expect(options()[0]?.label).toBe('Baja'), { timeout: 5000 });

    const http = TestBed.inject(HttpClient);
    const detail = await firstValueFrom(http.get<{ items: { uuid: string; code: string }[] }>('/api/catalogs/ticket-priority'));
    const low = detail.items.find((i) => i.code === 'low')!;
    await firstValueFrom(http.patch(`/api/catalogs/ticket-priority/items/${low.uuid}`, { code: 'low', label: 'Mínima', order: 10, active: true }));
    service.reloadAll();
    await vi.waitFor(() => expect(options()[0]?.label).toBe('Mínima'), { timeout: 5000 });
  });

  it('ignora códigos que el contrato no conoce y cae al respaldo si el catálogo no existe', async () => {
    await TestBed.inject(SessionStore).signInAs(EUserRole.ADMIN);
    const service = TestBed.inject(CatalogOptionsService);
    const unknown = service.options('no-existe', FALLBACK);
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(unknown().map((o) => o.value)).toEqual(['low', 'medium', 'high', 'critical']);
  });
});

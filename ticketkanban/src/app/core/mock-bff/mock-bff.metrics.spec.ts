import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { SummaryResponseSchema, AgentsResponseSchema, AgentDetailResponseSchema, ProblemsResponseSchema } from '../../pages/metrics/metrics.schema';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

/**
 * `/api/metrics/*` en el mock: mismo contrato que el backend (lo valida el MISMO schema que usa la pantalla) y
 * mismos permisos: el equipo ve todo con `Metric`; cada persona solo lo suyo con `MyMetric`.
 */
describe('mock BFF · métricas', () => {
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

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));
  const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> => readProblem(await promise.catch((e: unknown) => e))?.code;

  it('el supervisor consulta resumen, colaboradores y problemas, y las respuestas cumplen el contrato', async () => {
    await store.signInAs(EUserRole.SUPERVISOR);
    const summary = SummaryResponseSchema.parse(await get('/api/metrics/summary'));
    expect(summary.targets.resolutionCompliancePct).toBe(95);
    const agents = AgentsResponseSchema.parse(await get('/api/metrics/agents'));
    expect(agents.data.map((a) => a.email)).toEqual(expect.arrayContaining(['ana@ticketit.dev', 'luis@ticketit.dev']));
    ProblemsResponseSchema.parse(await get('/api/metrics/problems'));
  });

  it('A1: sin tickets suficientes cada indicador dice «sin información», no 0 %', async () => {
    await store.signInAs(EUserRole.SUPERVISOR);
    // Un período lejano al que no pertenece ningún ticket.
    const { summary } = SummaryResponseSchema.parse(await get('/api/metrics/summary?from=2020-01-01&to=2020-01-31'));
    expect(summary.tickets.created).toBe(0);
    for (const metric of [summary.firstContact, summary.firstResponse, summary.resolution, summary.reopenRate, summary.csat]) {
      expect(metric).toMatchObject({ value: null, status: 'no-data' });
    }
  });

  it('A2: un ticket abierto que superó su plazo cuenta como fuera de SLA', async () => {
    await store.signInAs(EUserRole.SUPERVISOR);
    // TCK-001 (crítico, abierto desde el 20/09) ya venció su plazo de 2 h.
    const ana = AgentDetailResponseSchema.parse(await get('/api/metrics/agents/ana%40ticketit.dev'));
    expect(ana.summary.tickets.overdue).toBeGreaterThanOrEqual(1);
    expect(ana.tickets.find((t) => t.code === 'TCK-001')?.resolutionStatus).toBe('breached');
  });

  it('A3: una persona sin tickets muestra sus indicadores en cero, no un error', async () => {
    await store.signInAs(EUserRole.SUPERVISOR);
    const nobody = AgentDetailResponseSchema.parse(await get('/api/metrics/agents/nadie%40ticketit.dev'));
    expect(nobody.tickets).toEqual([]);
    expect(nobody.summary.tickets).toMatchObject({ created: 0, pending: 0, resolved: 0, overdue: 0 });
    expect(nobody.summary.resolution.status).toBe('no-data');
  });

  it('un agente ve solo SUS métricas: las del equipo le dan 403', async () => {
    await store.signInAs(EUserRole.AGENT);
    expect(await codeOf(get('/api/metrics/summary'))).toBe('SAUT-E001');
    expect(await codeOf(get('/api/metrics/agents'))).toBe('SAUT-E001');
    const me = AgentDetailResponseSchema.parse(await get('/api/metrics/me'));
    expect(me.email).toBe(store.$user()?.email);
  });

  it('el cliente no ve métricas y un período inválido se rechaza', async () => {
    await store.signInAs(EUserRole.VIEWER);
    expect(await codeOf(get('/api/metrics/me'))).toBe('SAUT-E001');
    await store.signInAs(EUserRole.SUPERVISOR);
    expect(await codeOf(get('/api/metrics/summary?from=2026-10-10&to=2026-10-01'))).toBe('CVAL-E001');
    expect(await codeOf(get('/api/metrics/summary?from=2024-01-01&to=2026-10-01'))).toBe('CVAL-E001');
  });
});

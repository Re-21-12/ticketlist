import { buildMetricCards } from './metrics.cards';
import type { TSummary, TTargets } from './metrics.types';

const TARGETS: TTargets = { firstContactPct: 75, responseCompliancePct: 95, resolutionCompliancePct: 95, csat: 4.5, reopenPctMax: 5, csatMinResponses: 10 };

const EMPTY: TSummary = {
  tickets: { created: 0, attended: 0, pending: 0, resolved: 0, closed: 0, autoClosed: 0, escalated: 0, overdue: 0 },
  firstContact: { value: null, sample: 0, status: 'no-data' },
  firstResponse: { value: null, sample: 0, status: 'no-data', averageMinutes: null },
  resolution: { value: null, sample: 0, status: 'no-data', averageMinutes: null },
  reopenRate: { value: null, sample: 0, status: 'no-data' },
  csat: { value: null, sample: 0, status: 'no-data', satisfiedPct: null, responseRate: null, responses: 0, sent: 0 },
  backlogAging: { underOneDay: 0, oneToThreeDays: 0, overThreeDays: 0 },
};

describe('buildMetricCards', () => {
  it('sin tickets suficientes cada indicador dice «Sin información» (A1)', () => {
    const cards = buildMetricCards(EMPTY, TARGETS);
    expect(cards).toHaveLength(5);
    for (const card of cards) {
      expect(card.display).toBe('Sin información');
      expect(card.status).toBe('no-data');
    }
  });

  it('conserva el estado del semáforo que calcula el backend y muestra la meta', () => {
    const cards = buildMetricCards(
      { ...EMPTY, resolution: { value: 80, sample: 10, status: 'critical', averageMinutes: 150 } },
      TARGETS,
    );
    const sla = cards.find((c) => c.key === 'resolution');
    expect(sla).toMatchObject({ status: 'critical', target: 'Meta: > 95 %' });
    expect(sla?.detail).toContain('2 h 30 min');
  });

  it('con pocas respuestas de CSAT explica que los datos son insuficientes', () => {
    const cards = buildMetricCards({ ...EMPTY, csat: { ...EMPTY.csat, responses: 3, sent: 5 } }, TARGETS);
    expect(cards.find((c) => c.key === 'csat')?.detail).toContain('Datos insuficientes: 3 de 10');
  });
});

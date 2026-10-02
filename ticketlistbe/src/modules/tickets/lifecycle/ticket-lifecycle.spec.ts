import {
  allowedTargets,
  canTransition,
  eventActorOf,
  groupOf,
  initialStatus,
  isOpen,
  STATUS_GROUPS,
  TICKET_STATUS,
  TRANSITIONS,
  type TTransitionActor,
} from './ticket-lifecycle.js';

describe('ciclo de vida del ticket', () => {
  it('todo estado tiene su tabla de transiciones', () => {
    expect(Object.keys(TRANSITIONS).toSorted()).toEqual([...TICKET_STATUS].toSorted());
  });

  it('nace «Nuevo», o «Asignado» si ya trae responsable', () => {
    expect(initialStatus(false)).toBe('new');
    expect(initialStatus(true)).toBe('assigned');
  });

  it('el flujo feliz: nuevo → asignado → en atención → resuelto → cerrado por el cliente', () => {
    expect(canTransition('new', 'assigned', 'supervisor')).toBe(true);
    expect(canTransition('assigned', 'in_progress', 'agent')).toBe(true);
    expect(canTransition('in_progress', 'resolved', 'agent')).toBe(true);
    expect(canTransition('resolved', 'closed', 'customer')).toBe(true);
  });

  describe('cada rol hace SOLO lo suyo', () => {
    const ACTORS: TTransitionActor[] = ['agent', 'supervisor', 'admin', 'customer', 'system'];
    const doable = (from: Parameters<typeof allowedTargets>[0], actor: TTransitionActor) => allowedTargets(from, actor).toSorted();

    it('soporte (agente) atiende, pide información y resuelve; NO escala', () => {
      expect(doable('assigned', 'agent')).toEqual(['in_progress', 'pending_customer', 'resolved']);
      expect(canTransition('in_progress', 'escalated', 'agent')).toBe(false);
    });

    it('el supervisor SOLO escala y pide información; no atiende ni resuelve', () => {
      expect(doable('in_progress', 'supervisor')).toEqual(['escalated', 'pending_customer']);
      for (const from of TICKET_STATUS) expect(canTransition(from, 'resolved', 'supervisor')).toBe(false);
      for (const from of TICKET_STATUS) expect(canTransition(from, 'in_progress', 'supervisor') && from !== 'escalated').toBe(false);
    });

    it('soporte y supervisor pasan un ticket a «Pendiente del cliente»; el cliente no', () => {
      for (const actor of ['agent', 'supervisor', 'admin'] as const) expect(canTransition('in_progress', 'pending_customer', actor)).toBe(true);
      expect(canTransition('in_progress', 'pending_customer', 'customer')).toBe(false);
    });

    it('el cliente solo confirma el cierre o reabre; no mueve el trabajo', () => {
      expect(doable('resolved', 'customer')).toEqual(['closed', 'reopened']);
      expect(doable('closed', 'customer')).toEqual(['reopened']);
      for (const from of ['new', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'reopened'] as const) {
        expect(allowedTargets(from, 'customer'), from).toEqual([]);
      }
    });

    it('el administrador puede todo lo que pueden los demás roles del equipo', () => {
      for (const from of TICKET_STATUS) {
        for (const actor of ['agent', 'supervisor'] as const) {
          for (const to of allowedTargets(from, actor)) expect(canTransition(from, to, 'admin'), `${from} → ${to}`).toBe(true);
        }
      }
    });

    it('quien cierra es el cliente o el sistema (48 h); nadie del equipo cierra por el cliente', () => {
      for (const actor of ACTORS) expect(canTransition('resolved', 'closed', actor)).toBe(actor === 'customer' || actor === 'system');
    });

    it('el cliente que responde devuelve «Pendiente del cliente» a «En atención» (sistema)', () => {
      expect(canTransition('pending_customer', 'in_progress', 'system')).toBe(true);
    });
  });

  it('se reabre un resuelto o un cerrado (cliente, soporte o administrador), y desde ahí se retoma', () => {
    expect(canTransition('resolved', 'reopened', 'customer')).toBe(true);
    expect(canTransition('closed', 'reopened', 'agent')).toBe(true);
    expect(canTransition('closed', 'reopened', 'supervisor')).toBe(false);
    expect(canTransition('reopened', 'in_progress', 'agent')).toBe(true);
    expect(canTransition('in_progress', 'reopened', 'customer')).toBe(false);
  });

  it('no hay saltos imposibles: nuevo no cierra, cerrado no se resuelve, nada vuelve a «Nuevo»', () => {
    for (const actor of ['agent', 'supervisor', 'admin', 'customer', 'system'] as const) {
      expect(canTransition('new', 'closed', actor)).toBe(false);
      expect(canTransition('closed', 'resolved', actor)).toBe(false);
      for (const from of TICKET_STATUS) expect(canTransition(from, 'new', actor)).toBe(false);
    }
  });

  it('abierto = backlog; resuelto y cerrado no lo son', () => {
    expect(isOpen('pending_customer')).toBe(true);
    expect(isOpen('reopened')).toBe(true);
    expect(isOpen('resolved')).toBe(false);
    expect(isOpen('closed')).toBe(false);
  });

  it('el historial no distingue qué rol del equipo actuó: es «personal»', () => {
    expect(eventActorOf('agent')).toBe('staff');
    expect(eventActorOf('supervisor')).toBe('staff');
    expect(eventActorOf('admin')).toBe('staff');
    expect(eventActorOf('customer')).toBe('customer');
    expect(eventActorOf('system')).toBe('system');
  });

  describe('los estados son variaciones de tres grandes', () => {
    it('Reabierto es una variación de Nuevo; Resuelto, de Cerrado; el resto, de En atención', () => {
      expect(groupOf('reopened')).toBe('new');
      expect(groupOf('new')).toBe('new');
      expect(groupOf('resolved')).toBe('closed');
      expect(groupOf('closed')).toBe('closed');
      for (const status of ['assigned', 'in_progress', 'escalated', 'pending_customer'] as const) expect(groupOf(status)).toBe('in_attention');
    });

    it('cada estado cae en UN solo grupo y no queda ninguno fuera', () => {
      const all = Object.values(STATUS_GROUPS).flat();
      expect(all.toSorted()).toEqual([...TICKET_STATUS].toSorted());
      expect(new Set(all).size).toBe(all.length);
    });
  });
});

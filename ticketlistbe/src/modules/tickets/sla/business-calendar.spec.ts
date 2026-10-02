import { addBusinessMinutes, businessMinutesBetween, DEFAULT_CALENDAR, type IBusinessCalendar } from './business-calendar.js';

/**
 * Zona UTC−6 (Guatemala), jornada 8:00–17:00 de lunes a viernes. Las fechas del test se escriben en
 * HORA LOCAL con un helper para que se lean como las leería un supervisor.
 */
const local = (iso: string): Date => new Date(`${iso}-06:00`);
// 2026-10-05 es lunes.
const MON = '2026-10-05';
const TUE = '2026-10-06';
const FRI = '2026-10-09';
const SAT = '2026-10-10';
const NEXT_MON = '2026-10-12';

describe('businessMinutesBetween', () => {
  it('dentro de la jornada cuenta el tiempo corrido', () => {
    expect(businessMinutesBetween(local(`${MON}T09:00:00`), local(`${MON}T11:00:00`))).toBe(120);
  });

  it('no cuenta la noche: de 16:00 a 9:00 del día siguiente son 2 horas', () => {
    expect(businessMinutesBetween(local(`${MON}T16:00:00`), local(`${TUE}T09:00:00`))).toBe(60 + 60);
  });

  it('no cuenta el fin de semana: viernes 16:00 → lunes 9:00 son 2 horas', () => {
    expect(businessMinutesBetween(local(`${FRI}T16:00:00`), local(`${NEXT_MON}T09:00:00`))).toBe(120);
  });

  it('un ticket registrado fuera de horario empieza a contar al abrir', () => {
    expect(businessMinutesBetween(local(`${SAT}T10:00:00`), local(`${NEXT_MON}T08:30:00`))).toBe(30);
    expect(businessMinutesBetween(local(`${MON}T06:00:00`), local(`${MON}T08:00:00`))).toBe(0);
  });

  it('un día completo son 9 horas hábiles', () => {
    expect(businessMinutesBetween(local(`${MON}T00:00:00`), local(`${TUE}T00:00:00`))).toBe(9 * 60);
  });

  it('un feriado no cuenta', () => {
    const calendar: IBusinessCalendar = { ...DEFAULT_CALENDAR, holidays: [TUE] };
    expect(businessMinutesBetween(local(`${MON}T16:00:00`), local('2026-10-07T09:00:00'), calendar)).toBe(120);
  });

  it('las pausas (pendiente del cliente) se restan, también la que sigue abierta', () => {
    const pause = { start: local(`${MON}T10:00:00`).getTime(), end: local(`${MON}T12:00:00`).getTime() };
    expect(businessMinutesBetween(local(`${MON}T09:00:00`), local(`${MON}T14:00:00`), DEFAULT_CALENDAR, [pause])).toBe(180);
    const open = { start: local(`${MON}T10:00:00`).getTime(), end: null };
    expect(businessMinutesBetween(local(`${MON}T09:00:00`), local(`${MON}T14:00:00`), DEFAULT_CALENDAR, [open])).toBe(60);
  });

  it('una pausa fuera de la jornada no resta nada y una superpuesta no resta dos veces', () => {
    const night = { start: local(`${MON}T18:00:00`).getTime(), end: local(`${TUE}T07:00:00`).getTime() };
    expect(businessMinutesBetween(local(`${MON}T09:00:00`), local(`${TUE}T10:00:00`), DEFAULT_CALENDAR, [night])).toBe(8 * 60 + 120);
    const a = { start: local(`${MON}T10:00:00`).getTime(), end: local(`${MON}T12:00:00`).getTime() };
    const b = { start: local(`${MON}T11:00:00`).getTime(), end: local(`${MON}T13:00:00`).getTime() };
    expect(businessMinutesBetween(local(`${MON}T09:00:00`), local(`${MON}T14:00:00`), DEFAULT_CALENDAR, [a, b])).toBe(120);
  });

  it('to ≤ from → 0', () => {
    expect(businessMinutesBetween(local(`${MON}T11:00:00`), local(`${MON}T09:00:00`))).toBe(0);
  });
});

describe('addBusinessMinutes', () => {
  it('2 horas desde las 9:00 vencen a las 11:00', () => {
    expect(addBusinessMinutes(local(`${MON}T09:00:00`), 120)).toEqual(local(`${MON}T11:00:00`));
  });

  it('el plazo salta la noche: 2 h desde las 16:00 vencen a las 9:00 del día siguiente', () => {
    expect(addBusinessMinutes(local(`${MON}T16:00:00`), 120)).toEqual(local(`${TUE}T09:00:00`));
  });

  it('el plazo salta el fin de semana', () => {
    expect(addBusinessMinutes(local(`${FRI}T16:30:00`), 120)).toEqual(local(`${NEXT_MON}T09:30:00`));
  });

  it('registrado en sábado, el reloj arranca el lunes a las 8:00', () => {
    expect(addBusinessMinutes(local(`${SAT}T11:00:00`), 120)).toEqual(local(`${NEXT_MON}T10:00:00`));
  });

  it('8 horas hábiles: desde las 9:00 vencen a las 17:00; desde las 10:00, al día siguiente a las 9:00', () => {
    expect(addBusinessMinutes(local(`${MON}T09:00:00`), 8 * 60)).toEqual(local(`${MON}T17:00:00`));
    expect(addBusinessMinutes(local(`${MON}T10:00:00`), 8 * 60)).toEqual(local(`${TUE}T09:00:00`));
  });

  it('una pausa corre el vencimiento por lo que duró', () => {
    const pause = { start: local(`${MON}T10:00:00`).getTime(), end: local(`${MON}T12:00:00`).getTime() };
    expect(addBusinessMinutes(local(`${MON}T09:00:00`), 120, DEFAULT_CALENDAR, [pause])).toEqual(local(`${MON}T13:00:00`));
  });

  it('es la inversa de businessMinutesBetween', () => {
    const from = local(`${MON}T13:17:00`);
    for (const minutes of [30, 120, 480, 1440, 2880]) {
      const due = addBusinessMinutes(from, minutes);
      expect(businessMinutesBetween(from, due)).toBeCloseTo(minutes, 6);
    }
  });

  it('un calendario sin días laborales falla fuerte (no cuelga)', () => {
    expect(() => addBusinessMinutes(local(`${MON}T09:00:00`), 60, { ...DEFAULT_CALENDAR, workDays: [] })).toThrow();
  });
});

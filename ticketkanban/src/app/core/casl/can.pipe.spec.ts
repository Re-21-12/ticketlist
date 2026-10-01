import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { AppAbility } from './casl.types';
import { CanPipe } from './can.pipe';

describe('CanPipe', () => {
  let ability: AppAbility;
  let pipe: CanPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CanPipe, { provide: AppAbility, useValue: createMongoAbility() }],
    });
    ability = TestBed.inject(AppAbility);
    pipe = TestBed.inject(CanPipe);
  });

  it('devuelve un signal que se recalcula al actualizar las reglas (sin re-ejecutar el pipe)', () => {
    const canCreate = pipe.transform('create', 'Ticket');
    expect(canCreate()).toBe(false);

    ability.update([{ action: 'create', subject: 'Ticket' }]);
    expect(canCreate()).toBe(true);

    ability.update([]);
    expect(canCreate()).toBe(false);
  });

  it('evalúa reglas con condiciones sobre la instancia', () => {
    ability.update([
      { action: 'update', subject: 'Ticket', conditions: { assigneeEmail: 'ana@ticketit.dev' } },
    ]);
    expect(pipe.transform('update', 'Ticket', { assigneeEmail: 'ana@ticketit.dev' })()).toBe(true);
    expect(pipe.transform('update', 'Ticket', { assigneeEmail: 'luis@ticketit.dev' })()).toBe(false);
  });

  it('no muta el objeto recibido (CASL marca la copia, no el registro del store)', () => {
    const ticket = { assigneeEmail: 'ana@ticketit.dev' };
    pipe.transform('update', 'Ticket', ticket)();
    expect(Object.keys(ticket)).toEqual(['assigneeEmail']);
  });
});

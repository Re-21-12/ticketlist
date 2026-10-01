import type { Routes } from '@angular/router';
import { isRoutable, routableRoots } from './routable.util';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tickets' },
      { path: 'tickets', children: [] },
      { path: 'appearance', children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];

describe('routableRoots / isRoutable', () => {
  const roots = routableRoots(routes);

  it('incluye las rutas hijas del shell sin path y excluye el comodín', () => {
    expect([...roots].sort()).toEqual(['appearance', 'tickets']);
  });

  it('una URL con subrutas o query cae en su raíz', () => {
    expect(isRoutable('/tickets/list', roots)).toBe(true);
    expect(isRoutable('/appearance?x=1', roots)).toBe(true);
  });

  it('un destino sin pantalla NO es enrutable (el comodín lo mandaría al inicio en silencio)', () => {
    expect(isRoutable('/sharing', roots)).toBe(false);
    expect(isRoutable('/', roots)).toBe(false);
  });
});

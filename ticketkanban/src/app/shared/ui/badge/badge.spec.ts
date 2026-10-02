import { TestBed } from '@angular/core/testing';
import { provideOptimus } from '@openng/optimus-ui/config';
import { Badge } from './badge';

describe('Badge', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideOptimus({})] }));

  function render(inputs: { label: string; icon?: string | null; severity?: 'danger' | null }) {
    const fixture = TestBed.createComponent(Badge);
    fixture.componentRef.setInput('$label', inputs.label);
    fixture.componentRef.setInput('$icon', inputs.icon ?? null);
    fixture.componentRef.setInput('$severity', inputs.severity ?? null);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('el TEXTO siempre va; el ícono es decorativo (aria-hidden) y acepta la clase con o sin «pi»', () => {
    const root = render({ label: 'Crítica', icon: 'pi-exclamation-triangle', severity: 'danger' });
    expect(root.textContent).toContain('Crítica');
    const icon = root.querySelector('i')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.className).toContain('pi pi-exclamation-triangle');
    expect(render({ label: 'Alta', icon: 'pi pi-angle-up' }).querySelector('i')!.className).toContain('pi pi-angle-up');
  });

  it('sin ícono no pinta uno vacío', () => {
    expect(render({ label: 'Nuevo' }).querySelector('i')).toBeNull();
  });
});

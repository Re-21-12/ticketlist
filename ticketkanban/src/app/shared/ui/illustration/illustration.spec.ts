import { TestBed } from '@angular/core/testing';
import { Illustration } from './illustration';
import { ILLUSTRATIONS } from './illustration.types';

describe('Illustration', () => {
  it('cada escena dibuja un SVG decorativo (aria-hidden, sin texto)', () => {
    for (const name of ILLUSTRATIONS) {
      const fixture = TestBed.createComponent(Illustration);
      fixture.componentRef.setInput('$name', name);
      fixture.detectChanges();
      const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
      expect(svg?.getAttribute('aria-hidden'), name).toBe('true');
      expect(svg?.querySelectorAll('rect, circle, path').length, `${name} está vacía`).toBeGreaterThan(3);
      expect(svg?.textContent?.trim(), name).toBe('');
    }
  });
});

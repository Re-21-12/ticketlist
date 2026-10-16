import { TestBed } from '@angular/core/testing';
import { EvidencePicker } from './evidence-picker';

/** Evidencia del alta rápida: se valida al elegirla, pero NO se sube (el ticket todavía no existe). */
describe('EvidencePicker', () => {
  const WAIT = { timeout: 8000, interval: 100 };

  function render() {
    const fixture = TestBed.createComponent(EvidencePicker);
    fixture.autoDetectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function pick(root: HTMLElement, files: File[]): void {
    const input = root.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('indica los tipos admitidos y los topes', () => {
    const { root } = render();
    expect(root.textContent).toContain('Imágenes, PDF, Excel, CSV');
    expect(root.querySelector('input[type=file]')?.getAttribute('accept')).toContain('.xlsx');
    expect(root.textContent).toContain('(opcional)');
  });

  it('lo que cumple queda en la lista y en `$files`; se puede quitar', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(100)], 'despues.png'), new File([new Uint8Array(100)], 'informe.pdf')]);
    await vi.waitFor(() => expect(root.querySelectorAll('.ep-chip').length).toBe(2), WAIT);
    expect(fixture.componentInstance.$files().map((entry) => entry.kind)).toEqual(['image', 'document']);
    (root.querySelector('.ep-remove') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.ep-chip').length).toBe(1);
  });

  it('A2: un tipo no admitido o demasiado grande se rechaza con el motivo y no se agrega', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(10)], 'programa.exe'), new File([new Uint8Array(11 * 1024 * 1024)], 'grande.png')]);
    await vi.waitFor(() => expect(root.querySelectorAll('.ep-errors li').length).toBe(2), WAIT);
    expect(root.querySelector('.ep-errors')?.textContent).toContain('no es un tipo admitido');
    expect(fixture.componentInstance.$files()).toEqual([]);
  });

  it('no pasa de 5 archivos', async () => {
    const { root } = render();
    pick(root, Array.from({ length: 6 }, (_, i) => new File([new Uint8Array(10)], `foto-${i}.png`)));
    await vi.waitFor(() => expect(root.querySelectorAll('.ep-chip').length).toBe(5), WAIT);
    expect(root.querySelector('.ep-errors')?.textContent).toContain('Solo se pueden adjuntar 5 archivos');
  });
});

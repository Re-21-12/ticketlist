import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { EUserRole } from '../../../core/casl/ability.enum';
import { AppAbility } from '../../../core/casl/casl.types';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { resetMockBff } from '../../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../../../core/session/session.store';
import { EvidenceUploader } from './evidence-uploader';

const TCK_001 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01';

describe('EvidenceUploader', () => {
  const WAIT = { timeout: 8000, interval: 100 };

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])), { provide: MessageService, useValue: { add: vi.fn() } }, { provide: AppAbility, useValue: createMongoAbility() }],
    });
    await TestBed.inject(SessionStore).signInAs(EUserRole.AGENT);
  });

  function render() {
    const fixture = TestBed.createComponent(EvidenceUploader);
    fixture.componentRef.setInput('$ticketUuid', TCK_001);
    fixture.autoDetectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  /** Simula elegir archivos en el `<input type="file">`. */
  function pick(root: HTMLElement, files: File[]): void {
    const input = root.querySelector<HTMLInputElement>('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Los pendientes son los que aún no terminaron de subir; los adjuntos, los que ya están en el bucket. */
  const pending = (root: HTMLElement) => root.querySelectorAll('ul[aria-label="Archivos pendientes de subir"] li');
  const attached = (root: HTMLElement) => root.querySelectorAll('ul[aria-label="Archivos adjuntos"] li');

  it('indica los tipos admitidos y los topes', () => {
    const { root } = render();
    expect(root.textContent).toContain('Imágenes, PDF, Excel, CSV');
    expect(root.textContent).toContain('videos de hasta 5:00');
    expect(root.querySelector('input[type=file]')?.getAttribute('accept')).toContain('.xlsx');
    expect(root.querySelector('input[type=file]')?.getAttribute('accept')).toContain('.mp4');
  });

  it('zona de arrastrar y soltar: el mismo camino que el selector de archivos', () => {
    const { root } = render();
    const zone = root.querySelector('.ev-dropzone') as HTMLButtonElement;
    // El botón es la alternativa accesible al arrastre: se puede llegar con Enter y Espacio.
    expect(zone.tagName).toBe('BUTTON');
    expect(zone.textContent).toContain('Arrastra los archivos aquí');
    // El <input> real es el que recibe los archivos (también los soltados).
    expect(root.querySelector('input[type=file]')?.hasAttribute('multiple')).toBe(true);
  });

  it('lista lo elegido como pendiente antes de subirlo y luego como adjunto', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(100)], 'despues.png')]);
    // Al instante se ve el archivo con su «Pendiente»: la persona no espera a ciegas.
    await vi.waitFor(() => expect(pending(root).length).toBe(1), WAIT);
    expect(pending(root)[0].querySelector('.ev-badge')?.textContent).toContain('Pendiente');
    expect(attached(root).length).toBe(0);
    await vi.waitFor(() => expect(attached(root).length).toBe(1), WAIT);
    expect(pending(root).length).toBe(0);
    expect(fixture.componentInstance.$attachments().map((a) => a.kind)).toEqual(['image']);
  });

  it('sube lo que cumple, lo lista como adjunto y permite quitarlo', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(100)], 'despues.png'), new File([new Uint8Array(100)], 'informe.pdf')]);
    await vi.waitFor(() => expect(fixture.componentInstance.$attachments().length).toBe(2), WAIT);
    expect(fixture.componentInstance.$attachments().map((a) => a.kind)).toEqual(['image', 'document']);
    expect(root.querySelectorAll('.ev-chip').length).toBe(2);
    expect(root.querySelector('.ev-errors')?.textContent?.trim()).toBe('');
    (root.querySelector('.ev-remove') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.ev-chip').length).toBe(1);
  });

  it('un pendiente se puede quitar antes de que termine de subir', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(100)], 'foto.png')]);
    await vi.waitFor(() => expect(pending(root).length).toBe(1), WAIT);
    (pending(root)[0].querySelector('.ev-remove') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pending(root).length).toBe(0);
    // Aun así se sube: quitar de la lista no cancela la subida en curso.
    await vi.waitFor(() => expect(fixture.componentInstance.$attachments().length).toBe(1), WAIT);
  });

  it('A2: un archivo de un tipo no admitido o demasiado grande se rechaza con el motivo y NO se sube', async () => {
    const { fixture, root } = render();
    pick(root, [new File([new Uint8Array(10)], 'programa.exe'), new File([new Uint8Array(11 * 1024 * 1024)], 'grande.png')]);
    await vi.waitFor(() => expect(root.querySelectorAll('.ev-errors li').length).toBe(2), WAIT);
    expect(root.querySelector('.ev-errors')?.textContent).toContain('no es un tipo admitido');
    expect(root.querySelector('.ev-errors')?.textContent).toContain('Elige otro archivo');
    expect(fixture.componentInstance.$attachments()).toEqual([]);
  });

  it('no pasa de 5 archivos por vez', async () => {
    const { root } = render();
    pick(root, Array.from({ length: 6 }, (_, i) => new File([new Uint8Array(10)], `foto-${i}.png`)));
    await vi.waitFor(() => expect(root.querySelector('.ev-errors')?.textContent).toContain('Solo se pueden adjuntar 5 archivos'), { timeout: 15_000, interval: 100 });
    expect(root.querySelectorAll('.ev-chip').length).toBe(5);
  }, 30_000);
});

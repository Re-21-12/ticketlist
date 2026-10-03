import { checkEvidenceFile, formatBytes, formatDuration, kindOfFile } from './evidence.util';

const file = (name: string, size = 1000) => new File([new Uint8Array(Math.min(size, 16))], name, { type: '' }) as File & { size: number };
/** `File.size` es de solo lectura: se simula un tamaño grande sin reservar la memoria. */
const big = (name: string, size: number): File => Object.defineProperty(file(name), 'size', { value: size });

describe('evidence.util', () => {
  it('reconoce la familia por la extensión: imágenes, documentos y videos; lo demás no', () => {
    expect(kindOfFile({ name: 'foto.PNG' })).toBe('image');
    for (const name of ['a.pdf', 'b.xlsx', 'c.xls', 'd.csv', 'e.txt']) expect(kindOfFile({ name }), name).toBe('document');
    for (const name of ['a.mp4', 'b.mov', 'c.webm']) expect(kindOfFile({ name }), name).toBe('video');
    for (const name of ['virus.exe', 'archivo.zip', 'sin-extension', 'foto.heic']) expect(kindOfFile({ name }), name).toBeNull();
  });

  it('formatea tamaños y duraciones', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toContain('5');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(300)).toBe('5:00');
  });

  it('A2: un archivo que supera el tope de su familia se rechaza y se pide otro', async () => {
    const image = await checkEvidenceFile(big('grande.png', 11 * 1024 * 1024));
    expect(image.ok).toBe(false);
    expect(image.message).toContain('Elige otro archivo');
    expect((await checkEvidenceFile(big('enorme.pdf', 26 * 1024 * 1024))).ok).toBe(false);
    expect((await checkEvidenceFile(big('medio.pdf', 6 * 1024 * 1024))).ok).toBe(true); // el tope de un PDF es 25 MB
  });

  it('rechaza tipos no admitidos y archivos vacíos', async () => {
    expect((await checkEvidenceFile(file('programa.exe'))).message).toContain('no es un tipo admitido');
    expect((await checkEvidenceFile(big('vacio.pdf', 0))).message).toContain('vacío');
  });

  it('un video debe durar 5 minutos o menos; si no se puede medir, se rechaza', async () => {
    expect((await checkEvidenceFile(file('corto.mp4'), () => Promise.resolve(300))).ok).toBe(true);
    const largo = await checkEvidenceFile(file('largo.mp4'), () => Promise.resolve(301));
    expect(largo.ok).toBe(false);
    expect(largo.message).toContain('Elige un video más corto');
    expect((await checkEvidenceFile(file('raro.mp4'), () => Promise.resolve(null))).message).toContain('No se pudo comprobar la duración');
  });
});

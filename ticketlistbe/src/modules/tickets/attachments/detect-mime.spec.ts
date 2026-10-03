import { detectMime, safeFileName } from './detect-mime.js';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectMime', () => {
  it('reconoce evidencia común por su contenido', () => {
    expect(detectMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(detectMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectMime(Buffer.from('GIF89a....'))).toBe('image/gif');
    expect(detectMime(Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
    expect(detectMime(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    expect(detectMime(Buffer.from('línea de log: error 500\n'))).toBe('text/plain');
  });

  it('rechaza lo que no es evidencia: ejecutables, comprimidos y binarios', () => {
    expect(detectMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // .exe
    expect(detectMime(bytes(0x50, 0x4b, 0x03, 0x04, 0x00))).toBeNull(); // .zip cualquiera (no trae xl/workbook.xml)
    expect(detectMime(bytes(0x7f, 0x45, 0x4c, 0x46, 0x00))).toBeNull(); // ELF
    expect(detectMime(Buffer.alloc(0))).toBeNull();
  });

  it('un .png falso (en realidad texto con otro contenido) no se hace pasar por imagen', () => {
    expect(detectMime(Buffer.from('<script>alert(1)</script>'))).toBe('text/plain');
  });
});

describe('detectMime · Excel, CSV y video', () => {
  it('reconoce Excel (xlsx y xls) por su contenido, no por la extensión', () => {
    const xlsx = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from('....[Content_Types].xml....xl/workbook.xml....')]);
    expect(detectMime(xlsx, 'ventas.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(detectMime(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0), 'viejo.xls')).toBe('application/vnd.ms-excel');
  });

  it('CSV: texto con extensión .csv; sin ella es texto plano', () => {
    const csv = Buffer.from(['id,nombre', '1,Ana', ''].join(String.fromCharCode(10)));
    expect(detectMime(csv, 'datos.csv')).toBe('text/csv');
    expect(detectMime(csv, 'datos.txt')).toBe('text/plain');
  });

  it('reconoce video mp4, mov y webm por su cabecera', () => {
    // [tamaño(4)] 'ftyp' [marca(4)] [versión(4)] 'isom'
    const ftyp = (brand: string) => Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftyp' + brand), bytes(0, 0, 0, 0), Buffer.from('isom')]);
    expect(detectMime(ftyp('isom'))).toBe('video/mp4');
    expect(detectMime(ftyp('qt  '))).toBe('video/quicktime');
    expect(detectMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x80))).toBe('video/webm');
  });

  it('una foto HEIC (misma caja ftyp que el video) NO se acepta como video', () => {
    expect(detectMime(Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypheic'), bytes(0, 0, 0, 0), Buffer.from('mif1')]))).toBeNull();
  });
});

describe('safeFileName', () => {
  it('quita rutas y caracteres peligrosos', () => {
    expect(safeFileName(['..','..','windows','system32','evil.png'].join(String.fromCharCode(92)))).toBe('evil.png');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('a"b<c>.txt')).toBe('a_b_c_.txt');
    expect(safeFileName('')).toBe('archivo');
  });
});

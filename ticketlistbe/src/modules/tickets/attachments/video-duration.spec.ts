import { videoDurationSeconds } from './video-duration.js';

/** Caja ISO BMFF: tamaño (4) + tipo (4) + contenido. */
const box = (type: string, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
};
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

/** mvhd v0: versión+flags (4), creación (4), modificación (4), escala (4), duración (4) + relleno. */
const mvhd = (scale: number, duration: number): Buffer => box('mvhd', u32(0), u32(0), u32(0), u32(scale), u32(duration), Buffer.alloc(80));
const ftyp = (brand: string): Buffer => box('ftyp', Buffer.from(brand, 'latin1'), u32(0), Buffer.from('isom', 'latin1'));

describe('videoDurationSeconds · MP4/MOV', () => {
  it('lee la duración del mvhd (duración ÷ escala)', () => {
    const mp4 = Buffer.concat([ftyp('isom'), box('moov', mvhd(1000, 90_000)), box('mdat', Buffer.alloc(16))]);
    expect(videoDurationSeconds(mp4, 'video/mp4')).toBe(90);
  });

  it('funciona con el moov DESPUÉS de los datos (mdat primero) y con QuickTime', () => {
    const mov = Buffer.concat([ftyp('qt  '), box('mdat', Buffer.alloc(64)), box('moov', mvhd(600, 600 * 301))]);
    expect(videoDurationSeconds(mov, 'video/quicktime')).toBe(301);
  });

  it('MP4 fragmentado: usa mehd cuando el mvhd trae duración 0', () => {
    const mehd = box('mehd', u32(0), u32(120_000));
    const mp4 = Buffer.concat([ftyp('isom'), box('moov', mvhd(1000, 0), box('mvex', mehd))]);
    expect(videoDurationSeconds(mp4, 'video/mp4')).toBe(120);
  });

  it('sin moov o corrupto → null (no se acepta lo que no se puede verificar)', () => {
    expect(videoDurationSeconds(Buffer.concat([ftyp('isom'), box('free', Buffer.alloc(8))]), 'video/mp4')).toBeNull();
    expect(videoDurationSeconds(Buffer.from('no es un video'), 'video/mp4')).toBeNull();
  });
});

/** EBML mínimo: [EBML header][Segment[Info[TimecodeScale, Duration(float64)]]]. */
const ebml = (idBytes: number[], body: Buffer): Buffer => Buffer.concat([Buffer.from(idBytes), Buffer.from([0x80 | body.length]), body]);
const webm = (durationTicks: number, scale = 1_000_000): Buffer => {
  const header = ebml([0x1a, 0x45, 0xdf, 0xa3], Buffer.from([0x42, 0x86, 0x81, 0x01]));
  const timecode = ebml([0x2a, 0xd7, 0xb1], Buffer.from([(scale >> 24) & 255, (scale >> 16) & 255, (scale >> 8) & 255, scale & 255]));
  const dur = Buffer.alloc(8);
  dur.writeDoubleBE(durationTicks);
  const info = ebml([0x15, 0x49, 0xa9, 0x66], Buffer.concat([timecode, ebml([0x44, 0x89], dur)]));
  const segment = ebml([0x18, 0x53, 0x80, 0x67], info);
  return Buffer.concat([header, segment]);
};

describe('videoDurationSeconds · WebM', () => {
  it('lee Duration × TimecodeScale', () => {
    // 150 000 ticks de 1 ms = 150 s
    expect(videoDurationSeconds(webm(150_000), 'video/webm')).toBeCloseTo(150, 3);
  });

  it('un WebM sin Info → null', () => {
    expect(videoDurationSeconds(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]), 'video/webm')).toBeNull();
  });
});

/**
 * Duración de un video leída de su CABECERA (sin decodificarlo): lo que el servidor puede comprobar de verdad, en lugar
 * de fiarse de lo que diga el cliente. Devuelve segundos, o `null` si no se puede determinar (en ese caso el video se
 * rechaza: no se acepta algo cuya duración no se puede verificar).
 *
 *  · MP4 / MOV (ISO BMFF): caja `moov` → `mvhd` (duración ÷ escala de tiempo); en MP4 fragmentado, `mvex` → `mehd`.
 *  · WebM / Matroska (EBML): `Segment` → `Info` → `Duration` × `TimecodeScale`.
 */
export function videoDurationSeconds(buffer: Buffer, mime: string): number | null {
  try {
    if (mime === 'video/webm') return webmDuration(buffer);
    if (mime === 'video/mp4' || mime === 'video/quicktime') return mp4Duration(buffer);
  } catch {
    return null;
  }
  return null;
}

// ── MP4 / MOV ────────────────────────────────────────────────────────────────────────────────
interface IBox {
  type: string;
  start: number;
  /** Inicio del contenido (después de la cabecera de la caja). */
  body: number;
  end: number;
}

/** Cajas hijas dentro de `[from, to)`. Una caja con tamaño 0 llega hasta el final; tamaño 1 trae el real en 64 bits. */
function* boxes(buffer: Buffer, from: number, to: number): Generator<IBox> {
  let offset = from;
  while (offset + 8 <= to) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    let header = 8;
    if (size === 1) {
      if (offset + 16 > to) return;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = to - offset;
    }
    if (size < header || offset + size > to) {
      // La caja `mdat` (los datos) puede estar truncada al leer solo el principio; las de metadatos no.
      if (type !== 'mdat') return;
      size = to - offset;
    }
    yield { type, start: offset, body: offset + header, end: offset + size };
    offset += size;
  }
}

function mp4Duration(buffer: Buffer): number | null {
  for (const top of boxes(buffer, 0, buffer.length)) {
    if (top.type !== 'moov') continue;
    for (const child of boxes(buffer, top.body, top.end)) {
      if (child.type === 'mvhd') {
        const seconds = mvhdSeconds(buffer, child.body);
        if (seconds !== null && seconds > 0) return seconds;
      }
      if (child.type === 'mvex') {
        // MP4 fragmentado: la duración total vive en `mehd` (fragment_duration) con la escala del `mvhd`.
        const mvhd = [...boxes(buffer, top.body, top.end)].find((b) => b.type === 'mvhd');
        const scale = mvhd ? mvhdScale(buffer, mvhd.body) : null;
        for (const grand of boxes(buffer, child.body, child.end)) {
          if (grand.type !== 'mehd' || !scale) continue;
          const version = buffer[grand.body] ?? 0;
          const ticks = version === 1 ? Number(buffer.readBigUInt64BE(grand.body + 4)) : buffer.readUInt32BE(grand.body + 4);
          if (ticks > 0) return ticks / scale;
        }
      }
    }
  }
  return null;
}

function mvhdScale(buffer: Buffer, body: number): number | null {
  const version = buffer[body] ?? 0;
  const scale = version === 1 ? buffer.readUInt32BE(body + 20) : buffer.readUInt32BE(body + 12);
  return scale > 0 ? scale : null;
}

function mvhdSeconds(buffer: Buffer, body: number): number | null {
  const version = buffer[body] ?? 0;
  const scale = mvhdScale(buffer, body);
  if (!scale) return null;
  const duration = version === 1 ? Number(buffer.readBigUInt64BE(body + 24)) : buffer.readUInt32BE(body + 16);
  return duration / scale;
}

// ── WebM / Matroska ──────────────────────────────────────────────────────────────────────────
const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;

/** Lee un ID EBML (con sus bits de longitud) y devuelve `[id, bytes]`. */
function readId(buffer: Buffer, offset: number): [number, number] | null {
  const first = buffer[offset];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23; // 1..4
  if (length > 4 || offset + length > buffer.length) return null;
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + (buffer[offset + i] as number);
  return [id, length];
}

/** Lee un tamaño EBML (vint) y devuelve `[tamaño, bytes]`; `-1` = tamaño desconocido. */
function readSize(buffer: Buffer, offset: number): [number, number] | null {
  const first = buffer[offset];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23; // 1..8
  if (length > 8 || offset + length > buffer.length) return null;
  let value = first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    const byte = buffer[offset + i] as number;
    allOnes &&= byte === 0xff;
    value = value * 256 + byte;
  }
  return [allOnes ? -1 : value, length];
}

function webmDuration(buffer: Buffer): number | null {
  // Salta la cabecera EBML y entra al Segment; dentro busca Info.
  let offset = 0;
  const header = readId(buffer, offset);
  const headerSize = header && readSize(buffer, offset + header[1]);
  if (!header || !headerSize || headerSize[0] < 0) return null;
  offset += header[1] + headerSize[1] + headerSize[0];

  const segment = readId(buffer, offset);
  if (!segment || segment[0] !== ID_SEGMENT) return null;
  const segmentSize = readSize(buffer, offset + segment[1]);
  if (!segmentSize) return null;
  let cursor = offset + segment[1] + segmentSize[1];

  while (cursor < buffer.length) {
    const id = readId(buffer, cursor);
    if (!id) return null;
    const size = readSize(buffer, cursor + id[1]);
    if (!size) return null;
    const body = cursor + id[1] + size[1];
    if (id[0] === ID_INFO && size[0] >= 0) return infoDuration(buffer, body, body + size[0]);
    if (size[0] < 0) return null; // tamaño desconocido antes de Info: no hay forma segura de saltar
    cursor = body + size[0];
  }
  return null;
}

function infoDuration(buffer: Buffer, from: number, to: number): number | null {
  let scale = 1_000_000; // ns por tick: valor por defecto de Matroska
  let duration: number | null = null;
  let cursor = from;
  while (cursor < to) {
    const id = readId(buffer, cursor);
    if (!id) break;
    const size = readSize(buffer, cursor + id[1]);
    if (!size || size[0] < 0) break;
    const body = cursor + id[1] + size[1];
    if (id[0] === ID_TIMECODE_SCALE) {
      let value = 0;
      for (let i = 0; i < size[0]; i++) value = value * 256 + (buffer[body + i] as number);
      if (value > 0) scale = value;
    } else if (id[0] === ID_DURATION) {
      duration = size[0] === 4 ? buffer.readFloatBE(body) : size[0] === 8 ? buffer.readDoubleBE(body) : null;
    }
    cursor = body + size[0];
  }
  return duration !== null && Number.isFinite(duration) && duration > 0 ? (duration * scale) / 1e9 : null;
}

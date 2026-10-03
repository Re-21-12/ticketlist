/**
 * Tipo REAL de un archivo por su contenido (firmas de cabecera), no por el que declara el navegador: un `.png` que en
 * realidad es un script no pasa. Solo se aceptan los tipos de evidencia permitidos: imágenes, PDF, Excel (xlsx/xls), CSV,
 * texto y videos cortos (mp4/mov/webm).
 */
export type TAllowedMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel'
  | 'text/csv'
  | 'text/plain'
  | 'video/mp4'
  | 'video/quicktime'
  | 'video/webm';

const startsWith = (buffer: Buffer, signature: readonly number[], offset = 0): boolean =>
  buffer.length >= offset + signature.length && signature.every((byte, i) => buffer[offset + i] === byte);

/** Marcas (`ftyp`) de fotos HEIC/HEIF, que comparten contenedor con el video pero NO son video. */
const IMAGE_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif']);

export function detectMime(buffer: Buffer, fileName = ''): TAllowedMime | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38]) && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) return 'image/gif';
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  // Excel moderno: un zip (PK) que trae `xl/workbook.xml`. Un zip cualquiera NO pasa.
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes('xl/workbook.xml')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  // Excel 97-2003: contenedor OLE.
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'application/vnd.ms-excel';
  // Video: WebM/Matroska (EBML) y MP4/MOV (caja `ftyp`).
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buffer.subarray(8, 12).toString('latin1');
    if (IMAGE_BRANDS.has(brand)) return null;
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  if (!isPlainText(buffer)) return null;
  return fileName.toLowerCase().endsWith('.csv') ? 'text/csv' : 'text/plain';
}

/** Texto: UTF-8 válido y sin bytes nulos (los binarios casi siempre los traen). */
function isPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return true;
  } catch {
    // Un corte a mitad de carácter multibyte no invalida el texto.
    return buffer.length > sample.length && sample.length > 3 && isPlainText(buffer.subarray(0, sample.length - 3));
  }
}

/** Nombre seguro para mostrar y para `Content-Disposition`: sin rutas ni caracteres de control. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '_').trim();
  return (cleaned || 'archivo').slice(0, 120);
}

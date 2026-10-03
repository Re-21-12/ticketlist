import type { TAttachmentKind } from './evidence.types';

const MB = 1024 * 1024;

/** Topes por familia (espejo de `attachment-limits.ts` del backend; el servidor es quien decide). */
export const EVIDENCE_MAX_BYTES: Record<TAttachmentKind, number> = {
  image: 10 * MB,
  document: 25 * MB,
  video: 100 * MB,
};

/** Un video evidencia debe ser corto: no más de 5 minutos. */
export const EVIDENCE_MAX_VIDEO_SECONDS = 5 * 60;

/** Máximo de archivos por comentario o por cambio de estado. */
export const EVIDENCE_MAX_FILES = 5;

/** Tipos admitidos, por familia (extensión → familia). El servidor confirma por la FIRMA del contenido. */
const KIND_BY_EXTENSION: Record<string, TAttachmentKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  pdf: 'document',
  xlsx: 'document',
  xls: 'document',
  csv: 'document',
  txt: 'document',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
};

export const EVIDENCE_ACCEPT = Object.keys(KIND_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(',');

export const EVIDENCE_TYPES_TEXT = 'Imágenes, PDF, Excel, CSV, texto y videos cortos (MP4, MOV, WebM)';

export const kindOfExtension = (extension: string): TAttachmentKind | null => KIND_BY_EXTENSION[extension.toLowerCase()] ?? null;

/** Ícono y nombre de cada familia (el texto acompaña siempre al ícono). */
export const EVIDENCE_KIND_META: Record<TAttachmentKind, { icon: string; label: string }> = {
  image: { icon: 'pi-image', label: 'Imagen' },
  document: { icon: 'pi-file', label: 'Documento' },
  video: { icon: 'pi-video', label: 'Video' },
};

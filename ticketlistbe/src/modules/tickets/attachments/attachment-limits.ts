import type { TAllowedMime } from './detect-mime.js';

/** Familia de un adjunto: decide el tope de tamaño y cómo se muestra (miniatura, reproductor o enlace). */
export type TAttachmentKind = 'image' | 'document' | 'video';

const MB = 1024 * 1024;

/**
 * Topes de tamaño por familia. El archivo se lee en memoria al subirlo (multer) antes de pasar al bucket, por eso el
 * video lleva un tope (100 MB ≈ 5 min a ~2.7 Mb/s): la API tiene 512 MB y una subida a la vez no la ahoga.
 */
export const ATTACHMENT_MAX_BYTES: Record<TAttachmentKind, number> = {
  image: 10 * MB,
  document: 25 * MB,
  video: 100 * MB,
};

/** Tope del multer: el mayor de todos; el tope REAL de cada familia se comprueba con el tipo ya detectado. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(ATTACHMENT_MAX_BYTES));

/** Un video evidencia debe ser CORTO: no más de 5 minutos. */
export const MAX_VIDEO_SECONDS = 5 * 60;

const KIND_BY_MIME: Record<TAllowedMime, TAttachmentKind> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-excel': 'document',
  'text/csv': 'document',
  'text/plain': 'document',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
};

export const kindOfMime = (mime: TAllowedMime): TAttachmentKind => KIND_BY_MIME[mime];

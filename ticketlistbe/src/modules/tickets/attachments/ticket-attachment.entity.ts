import type { TAttachmentKind } from './attachment-limits.js';

/**
 * Evidencia adjunta a un ticket. Su CONTENIDO vive en el bucket de objetos (`objectKey`); aquí solo la metadata. Los
 * adjuntos anteriores al bucket conservan su contenido en `content` (se siguen sirviendo desde la base).
 */
export interface ITicketAttachment {
  id: string;
  ticketUuid: string;
  name: string;
  /** Tipo DETECTADO por el contenido, no el que declaró el navegador. */
  mimeType: string;
  size: number;
  /** Imagen, documento (PDF/Excel/CSV/texto) o video: decide cómo se muestra. */
  kind: TAttachmentKind;
  /** Solo videos: duración leída de la cabecera (≤ 5 min). */
  durationSeconds: number | null;
  /** Clave del objeto en el bucket (`tickets/<ticket>/<id>`); `null` en adjuntos antiguos. */
  objectKey: string | null;
  /** Solo adjuntos anteriores al bucket (contenido en la base). */
  content: Buffer | null;
  uploadedBy: string;
  createdAt: Date;
  /** `null` = subido pero aún sin comentario que lo use. */
  commentUuid: string | null;
}

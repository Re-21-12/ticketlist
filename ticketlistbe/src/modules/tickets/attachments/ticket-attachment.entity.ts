/** Evidencia adjunta a un ticket. El contenido se guarda en memoria hasta contar con almacenamiento de objetos. */
export interface ITicketAttachment {
  id: string;
  ticketUuid: string;
  name: string;
  /** Tipo DETECTADO por el contenido, no el que declaró el navegador. */
  mimeType: string;
  size: number;
  content: Buffer;
  uploadedBy: string;
  createdAt: Date;
  /** `null` = subido pero aún sin comentario que lo use. */
  commentUuid: string | null;
}

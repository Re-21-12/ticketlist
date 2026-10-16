import * as z from 'zod';
import type { ATTACHMENT_KINDS, AttachmentRefSchema } from './evidence.schema';

export type TAttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export type TAttachmentRef = z.output<typeof AttachmentRefSchema>;

/**
 * Un archivo elegido todavía sin subir. Se valida al elegirlo y se muestra en la lista de
 * pendientes ANTES de mandarlo al bucket: la persona ve lo que adjunto y puede quitarlo o mirarlo
 * (vista previa) sin esperar a que termine la subida. `token` identifica el pendiente en la lista
 * (`@for track`) y al quitarlo; `url` es un `blob:` local que se revoca al descartarlo.
 */
export interface IEvidenceDraft {
  token: string;
  name: string;
  mimeType: string;
  size: number;
  kind: TAttachmentKind;
  url: string;
}

export type TEvidenceDraft = IEvidenceDraft;
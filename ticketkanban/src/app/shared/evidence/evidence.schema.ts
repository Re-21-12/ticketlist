import { z } from 'zod';

export const ATTACHMENT_KINDS = ['image', 'document', 'video'] as const;

/** Un adjunto tal como lo devuelve el backend (espejo de `AttachmentRefSchema`). */
export const AttachmentRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  kind: z.enum(ATTACHMENT_KINDS),
  /** Solo videos: segundos (≤ 300). */
  durationSeconds: z.number().int().nullable(),
});

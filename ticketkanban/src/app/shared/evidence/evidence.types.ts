import type { z } from 'zod';
import type { ATTACHMENT_KINDS, AttachmentRefSchema } from './evidence.schema';

export type TAttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export type TAttachmentRef = z.output<typeof AttachmentRefSchema>;

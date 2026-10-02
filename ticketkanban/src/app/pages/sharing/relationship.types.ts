import type { z } from 'zod';
import type { GrantsFormSchema, RelationshipSchema, ShareFormSchema } from './relationship.schema';

export type TRelationship = z.output<typeof RelationshipSchema>;
export type TShareForm = z.output<typeof ShareFormSchema>;
export type TGrantsForm = z.output<typeof GrantsFormSchema>;

import type { z } from 'zod';
import type { RelationshipAdminSchema, RelationshipAdminViewSchema } from './relationship-admin.schema';

export type TRelationshipAdmin = z.output<typeof RelationshipAdminSchema>;
export type TRelationshipAdminView = z.output<typeof RelationshipAdminViewSchema>;

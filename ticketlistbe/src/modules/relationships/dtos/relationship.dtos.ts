import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import {
  RelationshipCreateSchema,
  RelationshipGrantsUpdateSchema,
} from '../schemas/relationship.schema.js';

export class CreateRelationshipDto extends createZodDto(RelationshipCreateSchema) {}
export class UpdateRelationshipGrantsDto extends createZodDto(RelationshipGrantsUpdateSchema) {}

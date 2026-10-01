import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { TicketCreateSchema } from '../schemas/ticket.schema.js';

export class CreateTicketDto extends createZodDto(TicketCreateSchema) {}

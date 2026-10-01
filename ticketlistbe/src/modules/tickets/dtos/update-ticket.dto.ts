import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { TicketUpsertSchema } from '../schemas/ticket.schema.js';

export class UpdateTicketDto extends createZodDto(TicketUpsertSchema) {}

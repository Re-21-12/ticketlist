import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../common/codes/validation-errors.js';
import { createZodDto } from '../zod/create-zod-dto.js';

export const UuidParamSchema = z.object({ uuid: z.uuid({ error: msg(V.GENERIC.IS_UUID) }) });

export class UuidParamDto extends createZodDto(UuidParamSchema) {}

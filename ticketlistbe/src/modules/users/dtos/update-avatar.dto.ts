import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { AVATAR_COLORS, AVATAR_ICONS } from '../avatar.const.js';

/** `null` en ambos = volver a las iniciales. Listas cerradas: nunca un valor libre. */
export const UpdateAvatarSchema = z.strictObject({
  avatarIcon: z
    .enum(AVATAR_ICONS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un ícono' }) })
    .nullable(),
  avatarColor: z
    .enum(AVATAR_COLORS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un color' }) })
    .nullable(),
});

export class UpdateAvatarDto extends createZodDto(UpdateAvatarSchema) {}

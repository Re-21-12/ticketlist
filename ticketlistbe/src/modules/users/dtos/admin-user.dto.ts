import * as z from 'zod';
import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { paginatedSchema } from '../../../core/dtos/paginated-response.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { SignUpSchema } from '../../auth/dtos/account-recovery.dto.js';
import { EUserRole } from '../../auth/casl/ability.enum.js';

/** Usuario tal como lo ve quien administra (nunca hash, sal ni tokens). */
export const AdminUserSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(EUserRole),
  avatarIcon: z.string().nullable(),
  avatarColor: z.string().nullable(),
  emailVerified: z.boolean(),
  /** Cuenta deshabilitada: no inicia sesión y sus sesiones abiertas se cierran. */
  disabled: z.boolean(),
  /** Bloqueada por intentos fallidos de inicio de sesión: solo un administrador la desbloquea. */
  locked: z.boolean(),
  lockedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Tiene el autenticador (TOTP) activo. */
  totpEnabled: z.boolean(),
  /** Entregó una contraseña temporal que la persona aún no cambia. */
  mustChangePassword: z.boolean(),
});

export const AdminUserPageSchema = paginatedSchema(AdminUserSchema);

export const AdminUserQuerySchema = BasePaginationSchema.extend({ role: z.enum(EUserRole).optional() });
export class AdminUserQueryDto extends createZodDto(AdminUserQuerySchema) {}

/** Solo el rol cambia; `strictObject` rechaza cualquier otro campo (asignación masiva). */
export const UpdateUserRoleSchema = z.strictObject({ role: z.enum(EUserRole) });
export class UpdateUserRoleDto extends createZodDto(UpdateUserRoleSchema) {}

/** `locked: false` DESBLOQUEA la cuenta (bloquear no se pide: solo ocurre por intentos fallidos). */
export const UpdateUserStatusSchema = z.strictObject({ disabled: z.boolean(), locked: z.literal(false).optional() });
export class UpdateUserStatusDto extends createZodDto(UpdateUserStatusSchema) {}

/** Alta por la administración: nombre, correo y rol; la contraseña la genera el servidor (temporal, de un solo uso). */
export const CreateUserSchema = z.strictObject({ name: SignUpSchema.shape.name, email: SignUpSchema.shape.email, role: z.enum(EUserRole) });
export class CreateUserDto extends createZodDto(CreateUserSchema) {}

/** La contraseña temporal se muestra UNA vez (no se guarda en claro): quien administra se la entrega a la persona. */
export const TempCredentialSchema = z.object({
  user: AdminUserSchema,
  tempPassword: z.string(),
  expiresAt: z.iso.datetime(),
});

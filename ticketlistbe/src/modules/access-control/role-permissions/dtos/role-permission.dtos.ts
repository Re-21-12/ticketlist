import type * as z from 'zod';
import { BasePaginationSchema } from '../../../../core/dtos/base-pagination.dto.js';
import { paginatedSchema } from '../../../../core/dtos/paginated-response.dto.js';
import { createZodDto } from '../../../../core/zod/create-zod-dto.js';
import {
  RolePermissionCreateSchema,
  RolePermissionFilterSchema,
  RolePermissionResponseSchema,
  RolePermissionUpdateSchema,
} from '../schemas/role-permission.schema.js';

export class CreateRolePermissionDto extends createZodDto(RolePermissionCreateSchema) {}
export class UpdateRolePermissionDto extends createZodDto(RolePermissionUpdateSchema) {}

export const RolePermissionQuerySchema = BasePaginationSchema.extend(RolePermissionFilterSchema.shape);
export class RolePermissionQueryDto extends createZodDto(RolePermissionQuerySchema) {}

export type TRolePermissionResponse = z.output<typeof RolePermissionResponseSchema>;
export const RolePermissionPageSchema = paginatedSchema(RolePermissionResponseSchema);

import { Module } from '@nestjs/common';
import { UsersAdminController } from './users-admin.controller.js';
import { UsersController } from './users.controller.js';

/**
 * Transporte: `/api/users/me/*` y `/api/users/assignable` (autoservicio) + `/api/users` (administración).
 * `UsersController` va primero: `assignable` debe resolverse antes que `:uuid`.
 */
@Module({ controllers: [UsersController, UsersAdminController] })
export class UsersHttpModule {}

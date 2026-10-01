import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';

/** Transporte: `/api/users/me/*`. El repositorio lo exporta `UsersModule` (global). */
@Module({ controllers: [UsersController] })
export class UsersHttpModule {}

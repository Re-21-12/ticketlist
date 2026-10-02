import { Module } from '@nestjs/common';
import { RelationshipsAdminController } from './relationships-admin.controller.js';
import { RelationshipsController } from './relationships.controller.js';

@Module({ controllers: [RelationshipsController, RelationshipsAdminController] })
export class RelationshipsHttpModule {}

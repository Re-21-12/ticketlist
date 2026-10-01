import { Module } from '@nestjs/common';
import { RelationshipsController } from './relationships.controller.js';

@Module({ controllers: [RelationshipsController] })
export class RelationshipsHttpModule {}

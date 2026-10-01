import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller.js';

/** `GET /api/problems/:code` — hace desreferenciable el `type` de RFC 9457. */
@Module({ controllers: [ProblemsController] })
export class ProblemsModule {}

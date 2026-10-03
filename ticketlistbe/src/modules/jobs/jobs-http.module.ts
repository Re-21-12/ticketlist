import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { JobsModule } from './jobs.module.js';

/** Transporte: `/api/jobs`. */
@Module({ imports: [JobsModule], controllers: [JobsController] })
export class JobsHttpModule {}

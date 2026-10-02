import { Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller.js';

/** Transporte: `/api/audit-logs` (solo lectura). */
@Module({ controllers: [AuditLogController] })
export class AuditLogHttpModule {}

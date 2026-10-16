import type { MigrationInterface } from 'typeorm';
import { AuditLogs1790899400000 } from './1790899400000-audit-logs.js';
import { InitialSchema1790899311932 } from './1790899311932-initial-schema.js';
import { EvidenceBucketSurveyJobs1791000000000 } from './1791000000000-evidence-bucket-survey-jobs.js';
import { RecoveryCodes1791200000000 } from './1791200000000-recovery-codes.js';
import { TicketStatusLabels1791300000000 } from './1791300000000-ticket-status-labels.js';
import { UserTempPassword1791100000000 } from './1791100000000-user-temp-password.js';

/** Migraciones en ORDEN (por marca de tiempo del nombre). Lista explícita (no glob): funciona igual en `dist/`. */
export const MIGRATIONS: (new () => MigrationInterface)[] = [InitialSchema1790899311932, AuditLogs1790899400000, EvidenceBucketSurveyJobs1791000000000, UserTempPassword1791100000000, RecoveryCodes1791200000000, TicketStatusLabels1791300000000];

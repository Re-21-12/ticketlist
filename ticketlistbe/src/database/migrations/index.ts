import type { MigrationInterface } from 'typeorm';
import { AuditLogs1790899400000 } from './1790899400000-audit-logs.js';
import { InitialSchema1790899311932 } from './1790899311932-initial-schema.js';
import { EvidenceBucketSurveyJobs1791000000000 } from './1791000000000-evidence-bucket-survey-jobs.js';

/** Migraciones en ORDEN (por marca de tiempo del nombre). Lista explícita (no glob): funciona igual en `dist/`. */
export const MIGRATIONS: (new () => MigrationInterface)[] = [InitialSchema1790899311932, AuditLogs1790899400000, EvidenceBucketSurveyJobs1791000000000];

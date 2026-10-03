import type { z } from 'zod';
import type { JobListSchema, JobSchema } from './jobs.schema';

export type TJob = z.output<typeof JobSchema>;
export type TJobList = z.output<typeof JobListSchema>;

import { TicketSurveySchema } from '../../../database/entity-schemas.js';
import { PersistenceService } from '../../../database/persistence.service.js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { TICKETS_SEED, type ITicketsSeed } from '../tickets.seed.js';
import type { ITicketSurvey } from './ticket-survey.entity.js';

@Injectable()
export class TicketSurveysRepository implements OnModuleInit {
  private surveys: ITicketSurvey[];

  constructor(
    @Inject(TICKETS_SEED) seed: ITicketsSeed,
    private readonly persistence: PersistenceService,
  ) {
    this.surveys = [...seed.surveys];
  }

  /** Con Postgres: lo guardado manda; las semillas (demostración) solo entran si la tabla está vacía. */
  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    const stored = await this.persistence.load(TicketSurveySchema);
    if (stored.length === 0 && this.surveys.length > 0) this.persistence.save(TicketSurveySchema, this.surveys);
    else this.surveys = stored;
  }

  find(ticketUuid: string): ITicketSurvey | null {
    return this.surveys.find((s) => s.ticketUuid === ticketUuid) ?? null;
  }

  add(survey: ITicketSurvey): void {
    this.surveys = [...this.surveys, survey];
    this.persistence.save(TicketSurveySchema, survey);
  }

  save(survey: ITicketSurvey): void {
    this.surveys = this.surveys.map((s) => (s.ticketUuid === survey.ticketUuid ? survey : s));
    this.persistence.save(TicketSurveySchema, survey);
  }

  listAll(): ITicketSurvey[] {
    return [...this.surveys];
  }
}

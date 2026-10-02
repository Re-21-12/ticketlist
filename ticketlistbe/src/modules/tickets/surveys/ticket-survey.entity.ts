/** Encuesta de satisfacción (CSAT) de UN ticket: se envía al cerrarlo, una sola vez y sin recordatorios. */
export interface ITicketSurvey {
  ticketUuid: string;
  requesterUuid: string;
  /** Responsable al cierre: a quien se atribuye la calificación. */
  assigneeEmail: string | null;
  sentAt: Date;
  /** Vence a los 7 días: pasado ese plazo ya no se acepta respuesta. */
  expiresAt: Date;
  answeredAt: Date | null;
  /** 1 a 5. */
  score: number | null;
  comment: string | null;
}

export const SURVEY_VALID_DAYS = 7;

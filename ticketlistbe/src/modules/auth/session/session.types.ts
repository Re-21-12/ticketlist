import 'express-session';

/** Lo que se guarda EN EL STORE (servidor) — la cookie solo lleva el id. */
declare module 'express-session' {
  interface SessionData {
    userUuid: string;
    /** epoch ms del login: para el tope absoluto de la sesión. */
    authenticatedAt: number;
    /** Desde dónde se inició (para «Mis sesiones»); dato del cliente, no confiable. */
    ip?: string;
    userAgent?: string;
  }
}

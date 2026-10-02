/** Token de inyección del servicio de correo. */
export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

export interface IMailMessage {
  to: string;
  subject: string;
  /** Cuerpo en texto plano. El enlace de acción va aparte para poder mostrarlo en desarrollo. */
  text: string;
  /** Enlace de acción (verificar correo, restablecer contraseña). */
  link: string;
}

/**
 * Puerto de salida de correo. Hoy hay UN adaptador (`LogMailService`, desarrollo y tests: no envía
 * nada, escribe el enlace en el log). Para producción se agrega un adaptador SMTP/API (Resend,
 * Mailgun…) que implemente esta interfaz y se elige en `MailModule` según el entorno: ningún
 * servicio de dominio cambia.
 */
export interface IMailService {
  send(message: IMailMessage): Promise<void>;
}

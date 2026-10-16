import type { HttpStatus } from '@nestjs/common';

export interface IErrorDetail {
  code: string;
  httpStatus: HttpStatus;
  messageEn: string;
  messageEs: string;
}

export interface IErrorContext {
  entity?: string;
  field?: string;
  value?: string;
  uuid?: string;
  /** 429: segundos hasta poder reintentar (también viaja en la cabecera `Retry-After`). */
  retryAfterSeconds?: number;
  /** 423 `SAUT-E014`: a quién pedirle el desbloqueo de una cuenta bloqueada (administradores). */
  contacts?: { name: string; email: string }[];
  /** 423 `SAUT-E014`: instante (ISO) en que la cuenta se desbloquea sola; ausente si solo la libera un administrador. */
  unlocksAt?: string;
}

export interface IServiceErrorCodes {
  NOT_FOUND: IErrorDetail;
  ALREADY_DELETED?: IErrorDetail;
  NOT_DELETED?: IErrorDetail;
}

export type TCodeModuleRegistry = Record<string, Record<string, IErrorDetail>>;

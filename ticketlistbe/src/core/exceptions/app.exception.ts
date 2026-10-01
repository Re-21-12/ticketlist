import { HttpException } from '@nestjs/common';
import type { IErrorContext, IErrorDetail } from '../interfaces/Icustom-code.interface.js';

/** Error de negocio con código del catálogo (`ERROR_CODES`) — igual que wallet-api. */
export class CustomBusinessException extends HttpException {
  constructor(
    public readonly errorDetail: IErrorDetail,
    public readonly context?: IErrorContext,
  ) {
    super(
      { code: errorDetail.code, message: errorDetail.messageEs, detail: context ?? null },
      errorDetail.httpStatus,
    );
  }
}

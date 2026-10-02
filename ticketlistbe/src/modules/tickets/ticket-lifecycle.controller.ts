import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { subject as asSubject } from '@casl/ability';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { ApiProblemResponse, ApiZodBody, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { createZodDto } from '../../core/zod/create-zod-dto.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { TicketAttachmentsRepository } from './attachments/ticket-attachments.repository.js';
import { detectMime, safeFileName } from './attachments/detect-mime.js';
import {
  AssignSchema,
  AttachmentResponseSchema,
  CommentCreateSchema,
  MAX_ATTACHMENT_BYTES,
  SurveyAnswerSchema,
  SurveyStateSchema,
  TicketEventListSchema,
  TicketEventResponseSchema,
  TransitionSchema,
} from './schemas/ticket-lifecycle.schema.js';
import { TicketResponseSchema } from './schemas/ticket.schema.js';
import { TicketLifecycleService } from './ticket-lifecycle.service.js';
import { TicketsRepository } from './tickets.repository.js';

class CommentDto extends createZodDto(CommentCreateSchema) {}
class TransitionDto extends createZodDto(TransitionSchema) {}
class AssignDto extends createZodDto(AssignSchema) {}
class SurveyAnswerDto extends createZodDto(SurveyAnswerSchema) {}

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
const E401 = [401, 'SAUT-E002 · Sin sesión'] as const;
const E403 = [403, 'SAUT-E001 · Sin permiso sobre este ticket'] as const;
const E404 = [404, 'RTCK-E001 · Ticket no encontrado o no visible para ti'] as const;

/** Archivo subido (multer en memoria); se tipa a mano para no depender de `@types/multer`. */
interface IUploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * Seguimiento del ticket: historial, comentarios (solo se AGREGAN), cambios de estado, asignación,
 * evidencia adjunta y encuesta de satisfacción. El permiso por TIPO es leer tickets; el de FILA
 * (¿es tu ticket? ¿lo atiendes?) lo decide `TicketLifecycleService`. Reglas en docs/standard/metrics.md.
 */
@ApiTags('Tickets · Seguimiento')
@Controller('tickets/:uuid')
export class TicketLifecycleController {
  constructor(
    private readonly lifecycle: TicketLifecycleService,
    private readonly attachments: TicketAttachmentsRepository,
    private readonly tickets: TicketsRepository,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  @Get('events')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodResponse(200, TicketEventListSchema)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E404)
  events(@Param() { uuid }: UuidParamDto): Promise<z.output<typeof TicketEventListSchema>> {
    return this.lifecycle.listEvents(uuid);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodBody(CommentCreateSchema)
  @ApiZodResponse(201, TicketEventResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Comentario vacío o demasiado largo')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(404, 'RATT-E001 · Adjunto inexistente o ya usado')
  @ApiProblemResponse(409, 'STCK-E003 · El ticket está cerrado')
  comment(@Param() { uuid }: UuidParamDto, @Body() dto: CommentDto) {
    return this.lifecycle.comment(uuid, dto);
  }

  /** Los comentarios previos NO se modifican ni se borran (trazabilidad): cualquier intento da 409. */
  @Patch('comments/:commentUuid')
  @ApiResponse({ status: 409, description: 'STCK-E002 · Los comentarios previos no pueden modificarse' })
  @CheckAbility(EAbility.READ, 'Ticket')
  patchComment(): never {
    return this.immutable();
  }

  @Put('comments/:commentUuid')
  @ApiResponse({ status: 409, description: 'STCK-E002 · Los comentarios previos no pueden modificarse' })
  @CheckAbility(EAbility.READ, 'Ticket')
  putComment(): never {
    return this.immutable();
  }

  @Delete('comments/:commentUuid')
  @ApiResponse({ status: 409, description: 'STCK-E002 · Los comentarios previos no pueden eliminarse' })
  @CheckAbility(EAbility.READ, 'Ticket')
  deleteComment(): never {
    return this.immutable();
  }

  private immutable(): never {
    throw new CustomBusinessException(ERROR_CODES.TCK.COMMENTS_IMMUTABLE);
  }

  @Post('transitions')
  @HttpCode(HttpStatus.OK)
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodBody(TransitionSchema)
  @ApiZodResponse(200, TicketResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Falta la solución al resolver')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(409, 'STCK-E001 · Transición no permitida · STCK-E004 · Venció la ventana de reapertura')
  transition(@Param() { uuid }: UuidParamDto, @Body() dto: TransitionDto) {
    return this.lifecycle.transition(uuid, dto);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodBody(AssignSchema)
  @ApiZodResponse(200, TicketResponseSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(422, 'STCK-E006 · Esa persona no puede recibir tickets')
  assign(@Param() { uuid }: UuidParamDto, @Body() dto: AssignDto) {
    return this.lifecycle.assign(uuid, dto);
  }

  // ── Evidencia ──────────────────────────────────────────────────────────────────────────────
  @Post('attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam(UUID_PARAM)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodResponse(201, AttachmentResponseSchema)
  @ApiProblemResponse(400, 'SATT-E003 · Falta el archivo')
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(413, 'SATT-E001 · El archivo supera 5 MB')
  @ApiProblemResponse(415, 'SATT-E002 · Tipo de archivo no permitido (imágenes, PDF y texto)')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } }))
  async upload(@Param() { uuid }: UuidParamDto, @UploadedFile() file: IUploadedFile | undefined) {
    const user = RequestContext.currentUser();
    const ticket = user && (await this.tickets.findByUuid(uuid));
    const ability = this.abilityFactory.createForUser(user);
    if (!user || !ticket || ticket.isDeleted || !ability.can(EAbility.READ, asSubject('Ticket', Object.assign({}, ticket)))) {
      throw new CustomBusinessException(ERROR_CODES.TCK.NOT_FOUND, { uuid });
    }
    if (!file) throw new CustomBusinessException(ERROR_CODES.ATT.FILE_REQUIRED);
    if (file.size > MAX_ATTACHMENT_BYTES) throw new CustomBusinessException(ERROR_CODES.ATT.TOO_LARGE);
    const mimeType = detectMime(file.buffer);
    if (!mimeType) throw new CustomBusinessException(ERROR_CODES.ATT.TYPE_NOT_ALLOWED);
    const attachment = {
      id: randomUUID(),
      ticketUuid: uuid,
      name: safeFileName(file.originalname),
      mimeType,
      size: file.size,
      content: file.buffer,
      uploadedBy: user.uuid,
      createdAt: new Date(),
      commentUuid: null,
    };
    this.attachments.add(attachment);
    return AttachmentResponseSchema.parse(attachment);
  }

  /** Descarga SIEMPRE como adjunto y con el tipo detectado: el navegador nunca lo ejecuta ni lo interpreta como página. */
  @Get('attachments/:attachmentId')
  @ApiParam(UUID_PARAM)
  @ApiParam({ name: 'attachmentId', schema: { type: 'string', format: 'uuid' } })
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiResponse({ status: 200, description: 'El archivo (descarga)' })
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(404, 'RATT-E001 · Adjunto no encontrado')
  async download(
    @Param() { uuid }: UuidParamDto,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // La comprobación de lectura del ticket la hace `listEvents` (404 si no es visible).
    await this.lifecycle.listEvents(uuid);
    const attachment = this.attachments.find(attachmentId, uuid);
    if (!attachment) throw new CustomBusinessException(ERROR_CODES.ATT.NOT_FOUND);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `attachment; filename="${attachment.name}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(attachment.content);
  }

  // ── Encuesta CSAT ──────────────────────────────────────────────────────────────────────────
  @Get('survey')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodResponse(200, SurveyStateSchema)
  @ApiProblemResponse(404, 'SSRV-E001 · No hay encuesta (no eres el solicitante o el ticket no está cerrado)')
  survey(@Param() { uuid }: UuidParamDto) {
    return this.lifecycle.surveyState(uuid);
  }

  @Post('survey')
  @HttpCode(HttpStatus.OK)
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodBody(SurveyAnswerSchema)
  @ApiZodResponse(200, SurveyStateSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Calificación fuera de 1–5')
  @ApiProblemResponse(404, 'SSRV-E001 · No hay encuesta disponible')
  @ApiProblemResponse(409, 'SSRV-E002 · Ya la respondiste')
  @ApiProblemResponse(410, 'SSRV-E003 · La encuesta venció')
  answerSurvey(@Param() { uuid }: UuidParamDto, @Body() dto: SurveyAnswerDto) {
    return this.lifecycle.answerSurvey(uuid, dto);
  }
}

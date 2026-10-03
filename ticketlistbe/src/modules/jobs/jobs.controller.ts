import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type * as z from 'zod';
import { ApiProblemResponse, ApiZodBody, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { createZodDto } from '../../core/zod/create-zod-dto.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { JobsService } from './jobs.service.js';
import { JobKeyParamSchema, JobListSchema, JobResponseSchema, JobUpdateSchema } from './jobs.schema.js';

class JobUpdateDto extends createZodDto(JobUpdateSchema) {}
class JobKeyParamDto extends createZodDto(JobKeyParamSchema) {}

const E401 = [401, 'SAUT-E002 · Sin sesión'] as const;
const E403 = [403, 'SAUT-E001 · Solo administración gestiona las tareas programadas'] as const;
const E404 = [404, 'RJOB-E001 · Tarea programada no encontrada'] as const;

/**
 * Tareas programadas (hoy, el cierre automático de tickets resueltos): el administrador las activa, cambia su cron y sus
 * parámetros, y puede ejecutarlas a mano. Cada cambio queda en la auditoría (middleware global).
 */
@ApiTags('Tareas programadas')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @CheckAbility(EAbility.READ, 'ScheduledJob')
  @ApiZodResponse(200, JobListSchema)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  list(): z.output<typeof JobListSchema> {
    return { data: this.jobs.list() };
  }

  @Patch(':key')
  @ApiParam({ name: 'key', schema: { type: 'string' } })
  @CheckAbility(EAbility.UPDATE, 'ScheduledJob')
  @ApiZodBody(JobUpdateSchema)
  @ApiZodResponse(200, JobResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Cron inválido o plazo fuera de rango')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  update(@Param() { key }: JobKeyParamDto, @Body() dto: JobUpdateDto): z.output<typeof JobResponseSchema> {
    return this.jobs.update(key, dto);
  }

  /** «Ejecutar ahora»: corre la tarea en este momento, aunque esté desactivada o no le toque. */
  @Post(':key/run')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'key', schema: { type: 'string' } })
  @CheckAbility(EAbility.UPDATE, 'ScheduledJob')
  @ApiZodResponse(200, JobResponseSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  run(@Param() { key }: JobKeyParamDto): z.output<typeof JobResponseSchema> {
    return this.jobs.run(key);
  }
}

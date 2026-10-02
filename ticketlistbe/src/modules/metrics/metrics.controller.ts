import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type * as z from 'zod';
import { ApiProblemResponse, ApiZodQuery, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { createZodDto } from '../../core/zod/create-zod-dto.js';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { MetricsService } from './metrics.service.js';
import {
  AgentDetailResponseSchema,
  AgentEmailParamSchema,
  AgentsResponseSchema,
  MetricsPeriodQuerySchema,
  ProblemsResponseSchema,
  SummaryResponseSchema,
} from './metrics.schema.js';

class PeriodQueryDto extends createZodDto(MetricsPeriodQuerySchema) {}
class AgentEmailParamDto extends createZodDto(AgentEmailParamSchema) {}

const E403 = [403, 'SAUT-E001 · Solo supervisión y administración ven las métricas del equipo'] as const;

/**
 * Métricas del servicio (FCR, SLA, CSAT — docs/standard/metrics.md). SOLO LECTURA: ningún endpoint
 * modifica tickets. Las del equipo exigen `read Metric` (supervisor, administrador); cada agente ve las
 * suyas con `read MyMetric`.
 */
@ApiTags('Métricas')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('summary')
  @CheckAbility(EAbility.READ, 'Metric')
  @ApiZodQuery(MetricsPeriodQuerySchema)
  @ApiZodResponse(200, SummaryResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Período inválido')
  @ApiProblemResponse(...E403)
  summary(@Query() query: PeriodQueryDto): z.output<typeof SummaryResponseSchema> {
    return this.metrics.summary(query);
  }

  @Get('agents')
  @CheckAbility(EAbility.READ, 'Metric')
  @ApiZodQuery(MetricsPeriodQuerySchema)
  @ApiZodResponse(200, AgentsResponseSchema)
  @ApiProblemResponse(...E403)
  agents(@Query() query: PeriodQueryDto): z.output<typeof AgentsResponseSchema> {
    return this.metrics.agents(query);
  }

  @Get('agents/:email')
  @ApiParam({ name: 'email', schema: { type: 'string', format: 'email' } })
  @CheckAbility(EAbility.READ, 'Metric')
  @ApiZodQuery(MetricsPeriodQuerySchema)
  @ApiZodResponse(200, AgentDetailResponseSchema)
  @ApiProblemResponse(...E403)
  agent(@Param() { email }: AgentEmailParamDto, @Query() query: PeriodQueryDto): z.output<typeof AgentDetailResponseSchema> {
    return this.metrics.agentDetail(email, query);
  }

  @Get('problems')
  @CheckAbility(EAbility.READ, 'Metric')
  @ApiZodQuery(MetricsPeriodQuerySchema)
  @ApiZodResponse(200, ProblemsResponseSchema)
  @ApiProblemResponse(...E403)
  problems(@Query() query: PeriodQueryDto): z.output<typeof ProblemsResponseSchema> {
    return this.metrics.problems(query);
  }

  /** Las métricas de quien consulta (un agente ve las suyas, sin acceso a las de sus compañeros). */
  @Get('me')
  @CheckAbility(EAbility.READ, 'MyMetric')
  @ApiZodQuery(MetricsPeriodQuerySchema)
  @ApiZodResponse(200, AgentDetailResponseSchema)
  @ApiProblemResponse(403, 'SAUT-E001 · Tu rol no tiene métricas personales')
  me(@Query() query: PeriodQueryDto): z.output<typeof AgentDetailResponseSchema> {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return this.metrics.agentDetail(user.email, query);
  }
}

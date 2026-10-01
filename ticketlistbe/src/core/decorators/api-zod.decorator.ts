import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import * as z from 'zod';
import { PROBLEM_JSON, ProblemDetailsSchema } from '../dtos/problem-details.dto.js';

type TJsonSchema = Record<string, unknown>;

/**
 * OpenAPI desde Zod con `z.toJSONSchema()` nativo de Zod 4 (target OpenAPI 3.0). Una sola
 * fuente: el schema que valida es el que se documenta — en wallet-api había que mantener
 * `@ApiProperty` en paralelo a los decoradores de class-validator.
 *
 * `io: 'input'` para lo que ENTRA (body/query: campos con default son opcionales) y
 * `io: 'output'` para lo que SALE.
 */
function toOpenApi(schema: z.ZodType, io: 'input' | 'output'): TJsonSchema {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io, unrepresentable: 'any' }) as TJsonSchema;
}

export const ApiZodBody = (schema: z.ZodType) =>
  ApiBody({ schema: toOpenApi(schema, 'input') as never });

export const ApiZodResponse = (status: number, schema: z.ZodType, description?: string) =>
  ApiResponse({ status, description, schema: toOpenApi(schema, 'output') as never });

/** Un `@ApiQuery` por propiedad del objeto (Swagger UI no expande un schema de query entero). */
export const ApiZodQuery = (schema: z.ZodObject) =>
  applyDecorators(
    ...Object.entries(schema.shape).map(([name, field]) =>
      ApiQuery({
        name,
        required: !(field as z.ZodType).safeParse(undefined).success,
        schema: toOpenApi(field as z.ZodType, 'input') as never,
      }),
    ),
  );

/**
 * Respuesta de error RFC 9457: `application/problem+json` con `ProblemDetailsSchema`. La
 * descripción sigue el formato `<código> · <cuándo>` (ver docs/standard/error-catalog.md).
 */
export const ApiProblemResponse = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    content: { [PROBLEM_JSON]: { schema: toOpenApi(ProblemDetailsSchema, 'output') as never } },
  });

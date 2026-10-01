import type * as z from 'zod';

/** Clase DTO con su schema Zod adjunto: el tipo de la instancia es el `z.output` del schema. */
export interface IZodDto<TSchema extends z.ZodType = z.ZodType> {
  new (): z.output<TSchema>;
  readonly schema: TSchema;
  readonly isZodDto: true;
}

/**
 * DTO a partir de un schema Zod (reemplaza a las clases con decoradores de class-validator de
 * wallet-api). Es una CLASE para que Nest conserve el metatipo del parámetro (`@Body() dto:
 * CreateTicketDto`): `ZodValidationPipe` lee `schema` de ahí y el decorador OpenAPI también.
 *
 * ```ts
 * export class CreateTicketDto extends createZodDto(TicketCreateSchema) {}
 * ```
 *
 * Se escribe a mano (~10 líneas) en vez de usar `nestjs-zod`: su v5.5 declara peers solo hasta
 * NestJS 11 y este proyecto usa NestJS 12.
 */
export function createZodDto<TSchema extends z.ZodType>(schema: TSchema): IZodDto<TSchema> {
  class ZodDto {
    static readonly schema = schema;
    static readonly isZodDto = true as const;
  }
  return ZodDto as unknown as IZodDto<TSchema>;
}

export function isZodDto(metatype: unknown): metatype is IZodDto {
  return typeof metatype === 'function' && (metatype as Partial<IZodDto>).isZodDto === true;
}

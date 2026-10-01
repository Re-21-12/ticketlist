import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { isZodDto } from '../zod/create-zod-dto.js';

/**
 * Pipe GLOBAL (equivale al `ValidationPipe` de wallet-api con whitelist): si el metatipo del
 * parámetro es un DTO Zod, valida y TRANSFORMA (`parse` devuelve el `z.output`: trims, coerción
 * de query params a número, defaults). Un `ZodError` lo convierte en 400 `CustomExceptionFilter`.
 *
 * Los `z.object()` por defecto descartan claves desconocidas (= `whitelist: true`); para
 * rechazarlas (= `forbidNonWhitelisted`) el schema usa `z.strictObject()`.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (!isZodDto(metadata.metatype)) return value;
    return metadata.metatype.schema.parse(value);
  }
}

import { ZodError } from 'zod';
import { BasePaginationDto } from '../dtos/base-pagination.dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('transforma con el schema del DTO (coerción + defaults)', () => {
    const out = pipe.transform({ page: '2' }, { type: 'query', metatype: BasePaginationDto });
    expect(out).toEqual({ page: 2, take: 10 });
  });

  it('lanza ZodError si no valida (el filtro lo convierte en 400)', () => {
    expect(() => pipe.transform({ page: '0' }, { type: 'query', metatype: BasePaginationDto })).toThrow(ZodError);
  });

  it('deja pasar parámetros que no son DTO Zod', () => {
    expect(pipe.transform('abc', { type: 'param', metatype: String })).toBe('abc');
  });
});

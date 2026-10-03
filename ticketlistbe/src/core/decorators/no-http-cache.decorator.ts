import { SetMetadata } from '@nestjs/common';

export const NO_HTTP_CACHE_KEY = 'noHttpCache';

/**
 * Excluye un GET del `HttpCacheInterceptor` (ETag, `max-age`): lo necesita un stream SSE, donde no hay UN cuerpo que
 * hashear y poner cabeceras tras el primer mensaje rompería la respuesta. El handler queda con `no-store`.
 */
export const NoHttpCache = () => SetMetadata(NO_HTTP_CACHE_KEY, true);

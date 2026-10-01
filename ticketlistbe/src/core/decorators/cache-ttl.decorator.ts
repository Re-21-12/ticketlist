import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cacheTtlSeconds';

/**
 * `max-age` del `Cache-Control` de un GET (RFC 9111 §5.2.2.1). Sin decorador = 0 (el navegador
 * guarda la copia pero SIEMPRE revalida con `If-None-Match`). Solo para datos que cambian poco
 * (catálogos); nunca para datos que dependen de permisos que pueden cambiar en la sesión.
 */
export const CacheTtl = (seconds: number) => SetMetadata(CACHE_TTL_KEY, seconds);

import { Injectable, MethodNotAllowedException, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

interface IExpressLayer {
  route?: { methods: Record<string, boolean> };
  handle?: { stack?: IExpressLayer[] };
  match?: (path: string) => boolean;
}

/** Métodos que algún handler registrado acepta para `path` (recorre routers anidados). */
export function collectAllowedMethods(stack: IExpressLayer[], path: string): Set<string> {
  const methods = new Set<string>();
  for (const layer of stack) {
    if (layer.route && layer.match?.(path)) {
      for (const method of Object.keys(layer.route.methods)) {
        // `_all` es la ruta comodín que Nest registra para sus middlewares, no un método real.
        if (method !== '_all') methods.add(method.toUpperCase());
      }
    } else if (layer.handle?.stack) {
      for (const method of collectAllowedMethods(layer.handle.stack, path)) methods.add(method);
    }
  }
  return methods;
}

/**
 * RFC 9110 §15.5.6: si la ruta existe pero NO con ese método, la respuesta es `405` con la
 * cabecera `Allow` (no `404`, que Nest devuelve por defecto). El cuerpo sale por el filtro global
 * como Problem Details (`NEST-E405`).
 */
@Injectable()
export class MethodNotAllowedMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'OPTIONS' || req.method === 'HEAD') return next();

    const internals = req.app as unknown as {
      router?: { stack: IExpressLayer[] };
      _router?: { stack: IExpressLayer[] };
    };
    const stack = internals.router?.stack ?? internals._router?.stack ?? [];
    // `req.path` llega sin el prefijo con el que Nest monta el middleware: se usa la URL original.
    const allowed = collectAllowedMethods(stack, req.originalUrl.split('?')[0]);
    // Sin ningún método para esa ruta es un 404 normal; con el método correcto, sigue.
    if (allowed.size === 0 || allowed.has(req.method)) return next();

    res.setHeader('Allow', [...allowed].sort().join(', '));
    throw new MethodNotAllowedException();
  }
}

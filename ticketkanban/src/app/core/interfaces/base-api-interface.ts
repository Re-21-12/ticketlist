import type { Observable } from 'rxjs';

/**
 * Contrato HTTP genérico imperativo (port de wallet-api). Para recursos CRUD usar
 * `BaseApiAbstract` (reactivo, con `httpResource`); esto queda para clientes puntuales que no
 * encajan en el CRUD estándar.
 */
export interface IRequest {
  url: string;
  body?: unknown;
  id?: number | string;
}

export interface IBaseApiService {
  getOne<T>(request: IRequest): Observable<T>;
  getMany<T>(request: IRequest): Observable<T[]>;
  post<T>(request: IRequest): Observable<T>;
  put<T>(request: IRequest): Observable<T>;
  delete(request: IRequest): Observable<boolean>;
}

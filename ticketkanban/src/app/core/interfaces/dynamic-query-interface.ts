/** Consulta dinámica genérica (port de wallet-api): tabla, filtros, orden, paginación y columnas. */
export interface IDynamicQuery {
  table: string;
  filters?: IDynamicQueryFilter | IDynamicQueryFilter[];
  order: 'asc' | 'desc';
  limit: number;
  page: number;
  /** Ej. 'nombre, posicion'; default '*'. */
  columns: string;
}

export interface IDynamicQueryFilter {
  field: string;
  value: string;
  operator?: 'eq' | 'gte' | 'lte' | 'ilike';
}

export interface IPaginationMeta {
  total: number;
  page: number;
  take: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  meta: IPaginationMeta;
}

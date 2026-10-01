export interface IBasePagination {
  page: number;
  take: number;
  includeDeleted?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

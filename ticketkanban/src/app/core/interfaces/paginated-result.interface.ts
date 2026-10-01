/** Espeja ticketlistbe/src/core/interfaces/Ipaginated-result.interface.ts (igual que wallet-api). */
export interface IPaginationMeta {
  total: number;
  page: number;
  take: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  meta: IPaginationMeta;
}

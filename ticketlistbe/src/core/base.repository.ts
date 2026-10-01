import type { BaseEntity } from './base.entity.js';
import type { IBasePagination } from './interfaces/Ibase-pagination.interface.js';
import type { IBaseRepository, TRowPredicate, TWhere } from './interfaces/Ibase.repository.js';

/** Copia con cambios CONSERVANDO el prototipo (un spread convertiría la entidad en objeto plano). */
function withChanges<T extends object>(row: T, changes: Partial<T>): T {
  return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row, changes);
}

/**
 * Capa de DATOS — implementación EN MEMORIA de `IBaseRepository` (mock). El contrato es el de
 * wallet-api (`findAll` → `[rows, total]`, borrado lógico, restore), así que cambiar a TypeORM es
 * reemplazar esta clase; servicio y controlador no se enteran.
 */
export abstract class InMemoryRepository<T extends BaseEntity> implements IBaseRepository<T> {
  protected rows: T[] = [];
  private nextId = 1;

  protected constructor(seed: T[] = []) {
    this.rows = seed.map((row) => withChanges(row, { id: this.nextId++ } as Partial<T>));
  }

  async findAll(
    pagination: IBasePagination,
    filters?: TWhere<T>,
    scope?: TWhere<T>,
    rowFilter?: TRowPredicate<T>,
  ): Promise<[T[], number]> {
    const matches = this.rows.filter(
      (row) =>
        (pagination.includeDeleted || !row.isDeleted) &&
        (!rowFilter || rowFilter(row)) &&
        this.matches(row, filters) &&
        this.matches(row, scope) &&
        this.matchesSearch(row, pagination.search),
    );
    const sorted = [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (pagination.page - 1) * pagination.take;
    return [sorted.slice(start, start + pagination.take), matches.length];
  }

  async findByUuid(uuid: string, scope?: TWhere<T>): Promise<T | null> {
    return this.rows.find((row) => row.uuid === uuid && this.matches(row, scope)) ?? null;
  }

  async create(entity: T): Promise<T> {
    const saved = withChanges(entity, { id: this.nextId++ } as Partial<T>);
    this.rows = [...this.rows, saved];
    return saved;
  }

  async update(entity: T): Promise<T> {
    this.rows = this.rows.map((row) => (row.uuid === entity.uuid ? entity : row));
    return entity;
  }

  async softDeleteByUuid(uuid: string, deletedBy: string): Promise<void> {
    this.patch(uuid, { isDeleted: true, deletedAt: new Date(), deletedBy } as Partial<T>);
  }

  async restoreByUuid(uuid: string, restoredBy: string): Promise<void> {
    this.patch(uuid, {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      restoredAt: new Date(),
      restoredBy,
    } as Partial<T>);
  }

  async existsByUuid(uuid: string, scope?: TWhere<T>): Promise<boolean> {
    return (await this.findByUuid(uuid, scope)) !== null;
  }

  /** Campos en los que busca `?search=` — la subclase los declara. */
  protected abstract readonly searchableFields: (keyof T)[];

  private matches(row: T, where?: TWhere<T>): boolean {
    return !where || Object.entries(where).every(([key, value]) => row[key as keyof T] === value);
  }

  private matchesSearch(row: T, search?: string): boolean {
    if (!search) return true;
    const needle = search.toLowerCase();
    return this.searchableFields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle));
  }

  private patch(uuid: string, changes: Partial<T>): void {
    this.rows = this.rows.map((row) => (row.uuid === uuid ? withChanges(row, changes) : row));
  }
}

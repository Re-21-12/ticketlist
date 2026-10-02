import type { OnModuleInit } from '@nestjs/common';
import type { EntitySchema } from 'typeorm';
import type { PersistenceService } from '../database/persistence.service.js';
import type { BaseEntity } from './base.entity.js';
import type { IBasePagination } from './interfaces/Ibase-pagination.interface.js';
import type { IBaseRepository, TRowPredicate, TWhere } from './interfaces/Ibase.repository.js';

/** Copia con cambios CONSERVANDO el prototipo (un spread convertiría la entidad en objeto plano). */
function withChanges<T extends object>(row: T, changes: Partial<T>): T {
  return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row, changes);
}

/**
 * Cómo se persiste un repositorio (TypeORM): su tabla, cómo armar la entidad desde una fila y cómo se siembra.
 *  - `seed: 'ensure'` → al arrancar se INSERTAN las semillas cuya clave natural falta (un lanzamiento que agrega un ítem de
 *    menú o un permiso lo recibe; lo que un administrador editó o eliminó no se pisa).
 *  - `seed: 'empty'`  → las semillas solo entran si la tabla está VACÍA (datos de demostración).
 */
export interface IRepositoryPersistence<T extends BaseEntity> {
  service: PersistenceService;
  schema: EntitySchema<T>;
  create: () => T;
  seed: 'ensure' | 'empty';
  /** Clave natural de una fila (para `seed: 'ensure'`). */
  naturalKey?: (row: T) => string;
}

/**
 * Capa de DATOS — implementación EN MEMORIA de `IBaseRepository` (mock). El contrato es el de
 * wallet-api (`findAll` → `[rows, total]`, borrado lógico, restore), así que cambiar a TypeORM es
 * reemplazar esta clase; servicio y controlador no se enteran.
 *
 * Con `persistence` (Postgres vía TypeORM, ver `PersistenceService`) las lecturas siguen saliendo de memoria y cada
 * cambio se guarda en la base; al arrancar se hidrata desde ella (`onModuleInit`).
 */
export abstract class InMemoryRepository<T extends BaseEntity> implements IBaseRepository<T>, OnModuleInit {
  private readonly persistence: IRepositoryPersistence<T> | undefined;
  protected rows: T[] = [];
  private nextId = 1;

  protected constructor(seed: T[] = [], persistence?: IRepositoryPersistence<T>) {
    this.rows = seed.map((row) => withChanges(row, { id: this.nextId++ } as Partial<T>));
    this.persistence = persistence;
  }

  /** Carga la tabla, le suma las semillas que falten y deja esa vista en memoria. Sin persistencia no hace nada. */
  async onModuleInit(): Promise<void> {
    const persistence = this.persistence;
    if (!persistence?.service.enabled) return;
    const stored = (await persistence.service.load(persistence.schema)).map((row) => Object.assign(persistence.create(), row));
    const seeds = this.rows; // lo que construyó el constructor (semillas en memoria)
    let lastId = stored.reduce((max, row) => Math.max(max, row.id), 0);
    const knownKeys = new Set(persistence.naturalKey ? stored.map(persistence.naturalKey) : []);
    const missing =
      persistence.seed === 'empty'
        ? stored.length === 0
          ? seeds
          : []
        : seeds.filter((row) => !knownKeys.has((persistence.naturalKey as (row: T) => string)(row)));
    const inserted = missing.map((row) => withChanges(row, { id: ++lastId } as Partial<T>));
    if (inserted.length > 0) persistence.service.save(persistence.schema, inserted);
    this.rows = [...stored, ...inserted];
    this.nextId = lastId + 1;
  }

  /** Guarda en la base (cola ordenada); no-op sin persistencia. */
  protected persist(row: T): void {
    this.persistence?.service.save(this.persistence.schema, row);
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
    this.persist(saved);
    return saved;
  }

  async update(entity: T): Promise<T> {
    this.rows = this.rows.map((row) => (row.uuid === entity.uuid ? entity : row));
    this.persist(entity);
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
    const changed = this.rows.find((row) => row.uuid === uuid);
    if (changed) this.persist(changed);
  }
}
